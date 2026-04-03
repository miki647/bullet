/**
 * GameState — finite state machine for game flow.
 *
 * States: MENU → PLAYING → GAMEOVER → MENU (restart)
 */
export type State = 'MENU' | 'PLAYING' | 'GAMEOVER';

export class GameState {
  private _current: State = 'MENU';
  private _onTransition: ((from: State, to: State) => void) | null = null;

  get current(): State {
    return this._current;
  }

  set onTransition(cb: (from: State, to: State) => void) {
    this._onTransition = cb;
  }

  transition(to: State): void {
    if (this._current === to) return;
    const from = this._current;
    this._current = to;
    this._onTransition?.(from, to);
  }

  get isMenu(): boolean { return this._current === 'MENU'; }
  get isPlaying(): boolean { return this._current === 'PLAYING'; }
  get isGameOver(): boolean { return this._current === 'GAMEOVER'; }
}
