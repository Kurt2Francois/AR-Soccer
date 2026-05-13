(function () {
  var BALL_Y = 0.042;
  var FIELD_X = 0.78;
  var FIELD_Z_MIN = -0.48;
  var FIELD_Z_MAX = 0.48;

  var scoreEl = document.getElementById("score");
  var shotsEl = document.getElementById("shots");
  var score = 0;
  var shots = 0;
  var scoredThisKick = false;

  var vx = 0;
  var vz = 0;
  var friction = 0.972;
  var kickStrength = 1.35;

  function clampBall(pos) {
    var x = pos.x;
    var z = pos.z;
    if (x > FIELD_X) {
      x = FIELD_X;
      vx *= -0.62;
    } else if (x < -FIELD_X) {
      x = -FIELD_X;
      vx *= -0.62;
    }
    if (z > FIELD_Z_MAX) {
      z = FIELD_Z_MAX;
      vz *= -0.62;
    } else if (z < FIELD_Z_MIN) {
      z = FIELD_Z_MIN;
      vz *= -0.62;
    }
    pos.x = x;
    pos.z = z;
    pos.y = BALL_Y;
  }

  function pointInGoal(x, z) {
    return Math.abs(x) <= 0.2 && z <= -0.36 && z >= -0.52;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var scene = document.querySelector("a-scene");
    if (!scene.hasLoaded) {
      scene.addEventListener("loaded", init);
    } else {
      init();
    }

    function init() {
      var ball = document.getElementById("ball");
      var marker = document.querySelector("a-marker");

      function resetBall() {
        ball.setAttribute("position", { x: 0, y: BALL_Y, z: 0.28 });
        vx = 0;
        vz = 0;
        scoredThisKick = false;
      }

      var pitch = document.querySelector(".kick-plane");
      pitch.addEventListener("click", function (evt) {
        var inter = evt.detail && evt.detail.intersection;
        if (!inter || !inter.point) return;

        var lp = marker.object3D.worldToLocal(inter.point.clone());
        var bx = ball.object3D.position.x;
        var bz = ball.object3D.position.z;

        var dx = lp.x - bx;
        var dz = lp.z - bz;
        var len = Math.sqrt(dx * dx + dz * dz) || 1;
        dx /= len;
        dz /= len;

        vx = dx * kickStrength;
        vz = dz * kickStrength;
        shots += 1;
        shotsEl.textContent = String(shots);
      });

      function tick() {
        var pos = ball.object3D.position;
        pos.x += vx * 0.016;
        pos.z += vz * 0.016;
        vx *= friction;
        vz *= friction;
        if (Math.abs(vx) < 0.002) vx = 0;
        if (Math.abs(vz) < 0.002) vz = 0;

        clampBall(pos);

        if (!scoredThisKick && pointInGoal(pos.x, pos.z)) {
          scoredThisKick = true;
          score += 1;
          scoreEl.textContent = String(score);
          window.setTimeout(resetBall, 900);
        }

        requestAnimationFrame(tick);
      }

      resetBall();
      requestAnimationFrame(tick);
    }
  });
})();
