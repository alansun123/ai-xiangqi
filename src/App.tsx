import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Side = 'red' | 'black'
type PieceType = 'general' | 'advisor' | 'elephant' | 'horse' | 'rook' | 'cannon' | 'soldier'

type Piece = {
  type: PieceType
  side: Side
}

type Pos = { row: number; col: number }
type Move = { from: Pos; to: Pos }

type Cell = Piece | null
type Board = Cell[][]

type Difficulty = 'easy' | 'medium' | 'hard'

const ROWS = 10
const COLS = 9

const PIECE_LABEL: Record<Side, Record<PieceType, string>> = {
  red: {
    general: '帅', advisor: '仕', elephant: '相', horse: '马', rook: '车', cannon: '炮', soldier: '兵',
  },
  black: {
    general: '将', advisor: '士', elephant: '象', horse: '马', rook: '车', cannon: '炮', soldier: '卒',
  },
}

const PIECE_VALUE: Record<PieceType, number> = {
  general: 10000, rook: 900, cannon: 450, horse: 400, elephant: 200, advisor: 200, soldier: 120,
}

function createInitialBoard(): Board {
  const board: Board = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null))
  const place = (row: number, col: number, side: Side, type: PieceType) => { board[row][col] = { side, type } }

  ;(['rook', 'horse', 'elephant', 'advisor', 'general', 'advisor', 'elephant', 'horse', 'rook'] as PieceType[])
    .forEach((type, col) => place(0, col, 'black', type))
  place(2, 1, 'black', 'cannon'); place(2, 7, 'black', 'cannon')
  ;[0, 2, 4, 6, 8].forEach((col) => place(3, col, 'black', 'soldier'))

  ;(['rook', 'horse', 'elephant', 'advisor', 'general', 'advisor', 'elephant', 'horse', 'rook'] as PieceType[])
    .forEach((type, col) => place(9, col, 'red', type))
  place(7, 1, 'red', 'cannon'); place(7, 7, 'red', 'cannon')
  ;[0, 2, 4, 6, 8].forEach((col) => place(6, col, 'red', 'soldier'))

  return board
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)))
}

function inBounds(row: number, col: number) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS
}

function samePos(a: Pos, b: Pos) {
  return a.row === b.row && a.col === b.col
}

function palaceContains(side: Side, row: number, col: number) {
  if (col < 3 || col > 5) return false
  return side === 'red' ? row >= 7 && row <= 9 : row >= 0 && row <= 2
}

function crossedRiver(side: Side, row: number) {
  return side === 'red' ? row <= 4 : row >= 5
}

function getGeneralPos(board: Board, side: Side): Pos | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (p?.side === side && p.type === 'general') return { row: r, col: c }
    }
  }
  return null
}

function pathClearCount(board: Board, from: Pos, to: Pos) {
  let count = 0
  if (from.row === to.row) {
    const [start, end] = from.col < to.col ? [from.col + 1, to.col] : [to.col + 1, from.col]
    for (let c = start; c < end; c++) if (board[from.row][c]) count++
  } else if (from.col === to.col) {
    const [start, end] = from.row < to.row ? [from.row + 1, to.row] : [to.row + 1, from.row]
    for (let r = start; r < end; r++) if (board[r][from.col]) count++
  }
  return count
}

function pieceAttacks(board: Board, from: Pos, to: Pos): boolean {
  const piece = board[from.row][from.col]
  if (!piece) return false
  const dr = to.row - from.row
  const dc = to.col - from.col
  const adr = Math.abs(dr)
  const adc = Math.abs(dc)
  const target = board[to.row][to.col]
  if (target?.side === piece.side) return false

  switch (piece.type) {
    case 'general':
      if (!palaceContains(piece.side, to.row, to.col)) return false
      return adr + adc === 1
    case 'advisor':
      return palaceContains(piece.side, to.row, to.col) && adr === 1 && adc === 1
    case 'elephant': {
      if (adr !== 2 || adc !== 2) return false
      if (piece.side === 'red' && to.row < 5) return false
      if (piece.side === 'black' && to.row > 4) return false
      return !board[from.row + dr / 2][from.col + dc / 2]
    }
    case 'horse': {
      if (!((adr === 2 && adc === 1) || (adr === 1 && adc === 2))) return false
      if (adr === 2) return !board[from.row + dr / 2][from.col]
      return !board[from.row][from.col + dc / 2]
    }
    case 'rook':
      return (from.row === to.row || from.col === to.col) && pathClearCount(board, from, to) === 0
    case 'cannon': {
      if (!(from.row === to.row || from.col === to.col)) return false
      const blockers = pathClearCount(board, from, to)
      return target ? blockers === 1 : blockers === 0
    }
    case 'soldier': {
      const forward = piece.side === 'red' ? -1 : 1
      if (dr === forward && dc === 0) return true
      if (crossedRiver(piece.side, from.row) && dr === 0 && adc === 1) return true
      return false
    }
  }
}

function generalsFacing(board: Board): boolean {
  const red = getGeneralPos(board, 'red')
  const black = getGeneralPos(board, 'black')
  if (!red || !black || red.col !== black.col) return false
  const [start, end] = red.row < black.row ? [red.row + 1, black.row] : [black.row + 1, red.row]
  for (let r = start; r < end; r++) if (board[r][red.col]) return false
  return true
}

function isInCheck(board: Board, side: Side): boolean {
  const general = getGeneralPos(board, side)
  if (!general) return true
  const enemy: Side = side === 'red' ? 'black' : 'red'
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (p?.side !== enemy) continue
      if (p.type === 'general') {
        if (c === general.col && pathClearCount(board, { row: r, col: c }, general) === 0) return true
      }
      if (pieceAttacks(board, { row: r, col: c }, general)) return true
    }
  }
  return false
}

function isLegalMove(board: Board, from: Pos, to: Pos, side: Side): boolean {
  if (!inBounds(to.row, to.col)) return false
  const piece = board[from.row][from.col]
  if (!piece || piece.side !== side) return false
  if (samePos(from, to)) return false
  if (!pieceAttacks(board, from, to)) return false

  const next = cloneBoard(board)
  next[to.row][to.col] = next[from.row][from.col]
  next[from.row][from.col] = null
  if (generalsFacing(next)) return false
  if (isInCheck(next, side)) return false
  return true
}

function allLegalMoves(board: Board, side: Side): Move[] {
  const moves: Move[] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (!p || p.side !== side) continue
      for (let tr = 0; tr < ROWS; tr++) {
        for (let tc = 0; tc < COLS; tc++) {
          const from = { row: r, col: c }
          const to = { row: tr, col: tc }
          if (isLegalMove(board, from, to, side)) moves.push({ from, to })
        }
      }
    }
  }
  return moves
}

function applyMove(board: Board, move: Move): Board {
  const next = cloneBoard(board)
  next[move.to.row][move.to.col] = next[move.from.row][move.from.col]
  next[move.from.row][move.from.col] = null
  return next
}

function evaluateBoard(board: Board): number {
  let score = 0
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (!p) continue
      let value = PIECE_VALUE[p.type]
      if (p.type === 'soldier' && crossedRiver(p.side, r)) value += 30
      if (p.type === 'horse' || p.type === 'rook' || p.type === 'cannon') {
        value += 8 - Math.abs(c - 4) * 1.2
      }
      score += p.side === 'red' ? value : -value
    }
  }

  if (isInCheck(board, 'red')) score -= 120
  if (isInCheck(board, 'black')) score += 120
  return score
}

function moveHeuristic(board: Board, move: Move, side: Side): number {
  let score = 0
  const moving = board[move.from.row][move.from.col]
  const target = board[move.to.row][move.to.col]

  if (target) score += PIECE_VALUE[target.type] * 2 - (moving ? PIECE_VALUE[moving.type] * 0.3 : 0)

  const next = applyMove(board, move)
  const enemy: Side = side === 'red' ? 'black' : 'red'
  if (isInCheck(next, enemy)) score += 180

  const centerBias = 4 - Math.abs(move.to.col - 4)
  score += centerBias * 8

  return score
}

function minimax(board: Board, depth: number, side: Side, alpha: number, beta: number): number {
  const moves = allLegalMoves(board, side)
  if (depth === 0 || moves.length === 0) {
    if (!moves.length) {
      if (isInCheck(board, side)) return side === 'black' ? 999999 : -999999
      return 0
    }
    return evaluateBoard(board)
  }

  const ordered = moves
    .map((m) => ({ m, h: moveHeuristic(board, m, side) }))
    .sort((a, b) => side === 'black' ? b.h - a.h : a.h - b.h)
    .map((x) => x.m)

  if (side === 'black') {
    let best = -Infinity
    for (const move of ordered) {
      const score = minimax(applyMove(board, move), depth - 1, 'red', alpha, beta)
      best = Math.max(best, score)
      alpha = Math.max(alpha, best)
      if (beta <= alpha) break
    }
    return best
  }

  let best = Infinity
  for (const move of ordered) {
    const score = minimax(applyMove(board, move), depth - 1, 'black', alpha, beta)
    best = Math.min(best, score)
    beta = Math.min(beta, best)
    if (beta <= alpha) break
  }
  return best
}

function pickAiMove(board: Board, difficulty: Difficulty): Move | null {
  const moves = allLegalMoves(board, 'black')
  if (!moves.length) return null
  if (difficulty === 'easy') return moves[Math.floor(Math.random() * moves.length)]

  const depth = difficulty === 'medium' ? 2 : 3
  let bestMove = moves[0]
  let bestScore = -Infinity

  const ordered = moves
    .map((m) => ({ m, h: moveHeuristic(board, m, 'black') }))
    .sort((a, b) => b.h - a.h)
    .map((x) => x.m)

  for (const move of ordered.slice(0, difficulty === 'medium' ? 18 : 24)) {
    const score = minimax(applyMove(board, move), depth - 1, 'red', -Infinity, Infinity)
    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  return bestMove
}

function statusText(board: Board, turn: Side) {
  const legal = allLegalMoves(board, turn)
  if (!legal.length) return turn === 'red' ? '黑方获胜' : '红方获胜'
  if (isInCheck(board, turn)) return turn === 'red' ? '红方被将军' : '黑方被将军'
  return turn === 'red' ? '轮到你走棋' : 'AI 思考中'
}

function App() {
  const [board, setBoard] = useState<Board>(() => createInitialBoard())
  const [selected, setSelected] = useState<Pos | null>(null)
  const [turn, setTurn] = useState<Side>('red')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [lastMove, setLastMove] = useState<Move | null>(null)
  const [captured, setCaptured] = useState<string[]>([])

  const legalTargets = useMemo(() => {
    if (!selected || turn !== 'red') return [] as Pos[]
    const result: Pos[] = []
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (isLegalMove(board, selected, { row: r, col: c }, 'red')) result.push({ row: r, col: c })
    return result
  }, [board, selected, turn])

  useEffect(() => {
    if (turn !== 'black') return
    const timer = setTimeout(() => {
      const move = pickAiMove(board, difficulty)
      if (!move) return
      const target = board[move.to.row][move.to.col]
      if (target) setCaptured((prev) => [...prev, PIECE_LABEL[target.side][target.type]])
      setBoard((prev) => applyMove(prev, move))
      setLastMove(move)
      setTurn('red')
      setSelected(null)
    }, difficulty === 'easy' ? 350 : difficulty === 'medium' ? 500 : 700)
    return () => clearTimeout(timer)
  }, [turn, board, difficulty])

  const onCellClick = (row: number, col: number) => {
    if (turn !== 'red') return
    const piece = board[row][col]
    if (piece?.side === 'red') {
      setSelected({ row, col })
      return
    }
    if (!selected) return
    const move = { from: selected, to: { row, col } }
    if (!isLegalMove(board, move.from, move.to, 'red')) return
    const target = board[row][col]
    if (target) setCaptured((prev) => [...prev, PIECE_LABEL[target.side][target.type]])
    setBoard((prev) => applyMove(prev, move))
    setLastMove(move)
    setTurn('black')
    setSelected(null)
  }

  const resetGame = () => {
    setBoard(createInitialBoard())
    setTurn('red')
    setSelected(null)
    setLastMove(null)
    setCaptured([])
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div>
          <h1>象棋工坊</h1>
          <p>暗色专业版 · 多难度 AI · 本地即玩</p>
        </div>
        <div className="controls">
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            <option value="easy">简单</option>
            <option value="medium">中等</option>
            <option value="hard">困难</option>
          </select>
          <button onClick={resetGame}>重新开始</button>
        </div>
      </div>

      <div className="content-grid">
        <section className="board-panel">
          <div className="board-status">{statusText(board, turn)}</div>
          <div className="board-wrap">
            <div className="board-surface">
              <svg className="board-svg" viewBox="0 0 8 9" preserveAspectRatio="none" aria-hidden>
                <rect x="0" y="0" width="8" height="9" fill="none" stroke="rgba(72,38,13,0.98)" strokeWidth="0.13" />
                <rect x="0.18" y="0.18" width="7.64" height="8.64" fill="none" stroke="rgba(72,38,13,0.82)" strokeWidth="0.05" />
                <line x1="0" y1="0" x2="0" y2="9" stroke="rgba(72,38,13,1)" strokeWidth="0.24" />
                <line x1="8" y1="0" x2="8" y2="9" stroke="rgba(72,38,13,1)" strokeWidth="0.24" />

                {[1,2,3,4,5,6,7].map((x) => (
                  <g key={`v-${x}`}>
                    <line x1={x} y1="0" x2={x} y2="4" stroke="rgba(72,38,13,0.88)" strokeWidth="0.04" />
                    <line x1={x} y1="5" x2={x} y2="9" stroke="rgba(72,38,13,0.88)" strokeWidth="0.04" />
                  </g>
                ))}
                {[0,1,2,3,4,5,6,7,8,9].map((y) => (
                  <line key={`h-${y}`} x1="0" y1={y} x2="8" y2={y} stroke="rgba(72,38,13,0.88)" strokeWidth="0.04" />
                ))}

                <line x1="3" y1="0" x2="5" y2="2" stroke="rgba(72,38,13,0.88)" strokeWidth="0.04" />
                <line x1="5" y1="0" x2="3" y2="2" stroke="rgba(72,38,13,0.88)" strokeWidth="0.04" />
                <line x1="3" y1="7" x2="5" y2="9" stroke="rgba(72,38,13,0.88)" strokeWidth="0.04" />
                <line x1="5" y1="7" x2="3" y2="9" stroke="rgba(72,38,13,0.88)" strokeWidth="0.04" />

                {[
                  { x: 1, y: 2 }, { x: 7, y: 2 }, { x: 1, y: 7 }, { x: 7, y: 7 },
                  { x: 0, y: 3 }, { x: 2, y: 3 }, { x: 4, y: 3 }, { x: 6, y: 3 }, { x: 8, y: 3 },
                  { x: 0, y: 6 }, { x: 2, y: 6 }, { x: 4, y: 6 }, { x: 6, y: 6 }, { x: 8, y: 6 },
                ].map(({ x, y }, idx) => {
                  const d = 0.13
                  const l = 0.18
                  const left = x > 0
                  const right = x < 8
                  return (
                    <g key={`mark-${idx}`} stroke="rgba(72,38,13,0.88)" strokeWidth="0.035">
                      {left && <line x1={x - d - l} y1={y - d} x2={x - d} y2={y - d} />}
                      {left && <line x1={x - d} y1={y - d - l} x2={x - d} y2={y - d} />}
                      {left && <line x1={x - d - l} y1={y + d} x2={x - d} y2={y + d} />}
                      {left && <line x1={x - d} y1={y + d} x2={x - d} y2={y + d + l} />}

                      {right && <line x1={x + d} y1={y - d} x2={x + d + l} y2={y - d} />}
                      {right && <line x1={x + d} y1={y - d - l} x2={x + d} y2={y - d} />}
                      {right && <line x1={x + d} y1={y + d} x2={x + d + l} y2={y + d} />}
                      {right && <line x1={x + d} y1={y + d} x2={x + d} y2={y + d + l} />}
                    </g>
                  )
                })}
              </svg>

              <div className="river"><span>楚河</span><span>汉界</span></div>

              {board.map((row, r) =>
                row.map((piece, c) => {
                  const isSelected = selected?.row === r && selected?.col === c
                  const isTarget = legalTargets.some((p) => p.row === r && p.col === c)
                  const isLast = lastMove && (samePos(lastMove.from, { row: r, col: c }) || samePos(lastMove.to, { row: r, col: c }))
                  return (
                    <button
                      key={`${r}-${c}`}
                      className={`point ${isSelected ? 'selected' : ''} ${isTarget ? 'target' : ''} ${isLast ? 'last' : ''}`}
                      style={{ left: `${(c / 8) * 100}%`, top: `${(r / 9) * 100}%` }}
                      onClick={() => onCellClick(r, c)}
                    >
                      {piece && <span className={`piece ${piece.side}`}>{PIECE_LABEL[piece.side][piece.type]}</span>}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </section>

        <aside className="side-panel">
          <div className="info-card">
            <h3>玩法亮点</h3>
            <ul>
              <li>完整基础规则：将、士、象、马、车、炮、兵</li>
              <li>三档难度：随机 / 贪心 / 简单搜索</li>
              <li>落子高亮、最近一步提示、暗色棋盘</li>
            </ul>
          </div>
          <div className="info-card">
            <h3>当前设置</h3>
            <p>执红先行</p>
            <p>AI 难度：{difficulty === 'easy' ? '简单' : difficulty === 'medium' ? '中等' : '困难'}</p>
          </div>
          <div className="info-card">
            <h3>吃子记录</h3>
            <div className="captured-list">{captured.length ? captured.join(' ') : '暂无'}</div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App
