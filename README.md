# Wumpus World AI Dashboard

A high-fidelity, interactive simulation of the classic **Wumpus World** artificial intelligence environment. The agent uses propositional logic and a resolution refutation inference engine to navigate the grid, avoid hazards, and retrieve the gold.


## 🚀 Features

- **Dynamic Inference Engine**: The agent maintains a Knowledge Base (KB) of clauses and uses logical deduction to prove cells are "Safe" or "Dangerous".
- **Real-Time Dashboard**:
    - **World Grid**: Visual representation of the environment with live updates, percept indicators (Breeze/Stench), and inference markers.
    - **Metrics Pane**: Track inference steps, cells visited, and clauses in the KB.
    - **KB Viewer**: Live feed of the propositional logic clauses being generated.
    - **Inference Log**: Detailed play-by-play of the agent's decision-making process.
- **Customizable Environment**: Adjust grid dimensions (up to 8x8) and simulation speed via the settings modal.
- **Modern Aesthetics**: Built with Tailwind CSS, Lucide Icons, and custom Google Fonts (Google Sans Flex & Press Start 2P) for a premium "Modern-Retro" feel.

## 🧠 How it Works

### 1. Percepts & Knowledge
Every time the agent visits a cell, it receives percepts:
- **Breeze**: A Pit is in an adjacent cell.
- **Stench**: The Wumpus is in an adjacent cell.
- **Glitter**: The Gold is in the current cell.

### 2. Propositional Logic
The agent translates these percepts into logical clauses. For example:
- `~Breeze(1,1) => ~Pit(1,2) & ~Pit(2,1)`
- `Stench(1,1) => Wumpus(1,2) | Wumpus(2,1)`

### 3. Resolution Refutation
To decide if a cell is safe, the agent attempts to prove a contradiction. To check if `(1,2)` is safe:
1. It adds the negation of the safety goal to the KB (`Pit(1,2)` or `Wumpus(1,2)`).
2. It performs resolution steps until it either finds an empty clause (proving the cell is safe) or exhausts all possibilities.

### 4. Navigation
The agent prioritizes:
1. **Safe Unvisited Cells**: Known safe cells it hasn't entered yet.
2. **Navigation**: BFS pathfinding to reach distant safe cells.
3. **Brave Moves**: If no safe moves exist, it calculates the "least risky" unknown cell based on its current KB.

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla JavaScript
- **Styling**: Vanilla CSS with direct color values (no variables or media queries)
- **Icons**: Lucide Icons
- **Typography**: Google Sans Flex (UI), Press Start 2P (Retro Accents)

## 📖 Usage

1. Open `wampus.html` in any modern web browser.
2. Click **New Episode** to generate a random world.
3. Use the **Play** button to start the auto-simulation or **Step** to advance manually.
4. Click the **Gear Icon** to adjust grid size and speed.

---

*Developed as a demonstration of Propositional Logic and AI Agent design.*
