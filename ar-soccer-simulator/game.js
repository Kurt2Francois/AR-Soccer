(function () {
  var BALL_Y = 0.045;
  var FIELD_X = 0.75;
  var FIELD_Z_MIN = -0.46;
  var FIELD_Z_MAX = 0.46;
  var GOAL_LINE_Z = -0.38;
  var GOAL_HALF_WIDTH = 0.19;
  var MIN_KICK_SPEED = 0.35;
  var MIN_GOAL_SPEED = 0.12;

  var scoreEl = document.getElementById("score");
  var shotsEl = document.getElementById("shots");
  var statusEl = document.getElementById("ar-status");
  var score = 0;
  var shots = 0;
  var scoredThisKick = false;
  var markerLocked = false;
  var prevBallZ = 0;
  var lastKickAt = 0;

  var vx = 0;
  var vz = 0;
  var friction = 0.97;
  var kickStrength = 1.45;

  var THREE;
  var invMarker;
  var originL;
  var dirL;
  var hitL;
  var raycaster;
  var ndc = null;

  function inGoalMouth(x, z) {
    return Math.abs(x) <= GOAL_HALF_WIDTH && z <= GOAL_LINE_Z && z >= -0.52;
  }

  function clampBall(pos) {
    var x = pos.x;
    var z = pos.z;
    if (x > FIELD_X) {
      x = FIELD_X;
      vx *= -0.55;
    } else if (x < -FIELD_X) {
      x = -FIELD_X;
      vx *= -0.55;
    }
    if (z > FIELD_Z_MAX) {
      z = FIELD_Z_MAX;
      vz *= -0.55;
    } else if (z < FIELD_Z_MIN) {
      z = FIELD_Z_MIN;
      vz *= -0.55;
    }
    pos.x = x;
    pos.z = z;
    pos.y = BALL_Y;
  }

  function pointerClientXY(e) {
    if (e.changedTouches && e.changedTouches.length) {
      return {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY,
      };
    }
    return { x: e.clientX, y: e.clientY };
  }

  document.addEventListener("DOMContentLoaded", function () {
    var scene = document.querySelector("a-scene");
    if (!scene) return;
    if (!scene.hasLoaded) {
      scene.addEventListener("loaded", init);
    } else {
      init();
    }

    function init() {
      THREE = AFRAME.THREE;
      invMarker = new THREE.Matrix4();
      originL = new THREE.Vector3();
      dirL = new THREE.Vector3();
      hitL = new THREE.Vector3();
      raycaster = new THREE.Raycaster();
      ndc = new THREE.Vector2();

      var ball = document.getElementById("ball");
      var marker = document.getElementById("hiro-marker");

      function setStatus(searching) {
        if (!statusEl) return;
        statusEl.classList.remove("searching", "locked");
        if (searching) {
          statusEl.classList.add("searching");
          statusEl.textContent =
            "Searching for Hiro marker… hold it steady, bright, and large in view.";
        } else {
          statusEl.classList.add("locked");
          statusEl.textContent =
            "Field locked — tap or click on the video to aim your shot.";
        }
      }

      function resetBall() {
        ball.setAttribute("position", { x: 0, y: BALL_Y, z: 0.28 });
        vx = 0;
        vz = 0;
        scoredThisKick = false;
        prevBallZ = 0.28;
      }

      marker.addEventListener("markerFound", function () {
        markerLocked = true;
        setStatus(false);
        resetBall();
      });
      marker.addEventListener("markerLost", function () {
        markerLocked = false;
        setStatus(true);
        vx = 0;
        vz = 0;
        scoredThisKick = false;
      });

      setStatus(true);

      function kickFromPointer(clientX, clientY) {
        if (!markerLocked || !scene.camera) return;
        if (clientX === undefined || clientY === undefined) return;
        var now = performance.now();
        if (now - lastKickAt < 180) return;
        lastKickAt = now;

        var canvas = scene.canvas;
        if (!canvas) return;
        var rect = canvas.getBoundingClientRect();
        var w = rect.width || 1;
        var h = rect.height || 1;
        ndc.x = ((clientX - rect.left) / w) * 2 - 1;
        ndc.y = -((clientY - rect.top) / h) * 2 + 1;

        raycaster.setFromCamera(ndc, scene.camera);

        invMarker.copy(marker.object3D.matrixWorld).invert();
        originL.copy(raycaster.ray.origin).applyMatrix4(invMarker);
        dirL.copy(raycaster.ray.direction).transformDirection(invMarker).normalize();

        if (Math.abs(dirL.y) < 1e-5) return;
        var t = -originL.y / dirL.y;
        if (t < 0 || t > 80) return;

        hitL.copy(originL).addScaledVector(dirL, t);
        var tx = Math.max(-FIELD_X, Math.min(FIELD_X, hitL.x));
        var tz = Math.max(FIELD_Z_MIN, Math.min(FIELD_Z_MAX, hitL.z));

        var bx = ball.object3D.position.x;
        var bz = ball.object3D.position.z;
        var dx = tx - bx;
        var dz = tz - bz;
        var len = Math.sqrt(dx * dx + dz * dz) || 1;
        dx /= len;
        dz /= len;

        vx = dx * kickStrength;
        vz = dz * kickStrength;
        var speed = Math.hypot(vx, vz);
        if (speed < MIN_KICK_SPEED && speed > 1e-6) {
          var s = MIN_KICK_SPEED / speed;
          vx *= s;
          vz *= s;
        }

        shots += 1;
        shotsEl.textContent = String(shots);
      }

      function bindCanvas() {
        var canvas = scene.canvas;
        if (!canvas) {
          requestAnimationFrame(bindCanvas);
          return;
        }

        function onKickInput(e) {
          if (e.button !== undefined && e.button !== 0) return;
          var pt = pointerClientXY(e);
          kickFromPointer(pt.x, pt.y);
        }

        if (window.PointerEvent) {
          canvas.addEventListener("pointerdown", onKickInput);
        } else {
          canvas.addEventListener("touchstart", onKickInput, { passive: true });
          canvas.addEventListener("mousedown", onKickInput);
        }
      }
      bindCanvas();

      function tick() {
        var pos = ball.object3D.position;
        if (markerLocked) {
          pos.x += vx * 0.016;
          pos.z += vz * 0.016;
          vx *= friction;
          vz *= friction;
          if (Math.abs(vx) < 0.0015) vx = 0;
          if (Math.abs(vz) < 0.0015) vz = 0;
          clampBall(pos);

          var crossed =
            prevBallZ > GOAL_LINE_Z + 0.02 &&
            pos.z <= GOAL_LINE_Z &&
            vz < -MIN_GOAL_SPEED;
          if (
            !scoredThisKick &&
            crossed &&
            Math.abs(pos.x) <= GOAL_HALF_WIDTH &&
            inGoalMouth(pos.x, pos.z)
          ) {
            scoredThisKick = true;
            score += 1;
            scoreEl.textContent = String(score);
            window.setTimeout(resetBall, 850);
          }
          prevBallZ = pos.z;
        }

        requestAnimationFrame(tick);
      }

      resetBall();
      requestAnimationFrame(tick);
    }
  });
})();
