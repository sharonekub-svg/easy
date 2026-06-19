/* ===== EZ game — MECCHA CHAMELEON =====
 * A polished browser/WebGL hide & seek: camouflage your body colour to vanish
 * from a roaming hunter. This file is now a thin mount adapter — the game lives
 * in clean ES modules under ./game/ (engine, input, audio, chameleon, maps,
 * entities, fx, ui, game). Registers window.EZGames.hideout.mount(canvas, opts).
 */
import { Game } from './game/game.js';

(function (root) {
  'use strict';

  function mount(canvas, opts) {
    var game = new Game(canvas, opts || {});
    return {
      reset: function () { game.reset(); },
      isPaused: function () { return game.isPaused(); },
      pause: function () { game.pause(); },
      resume: function () { game.resume(); },
      togglePause: function () { return game.togglePause(); },
      resize: function () { game.resize(); },
      dispose: function () { game.dispose(); }
    };
  }

  (root.EZGames || (root.EZGames = {})).hideout = { mount: mount };
})(window);
