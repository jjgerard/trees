# Tree studio

A drawing tool for publication-quality syntax trees, for people who already know how trees work.
It runs in the browser, needs no account or install, stores nothing on a server, and has no build step.

**Use it:** https://jjgerard.github.io/trees/

## Making a tree

- **Build it.** The **Parts** shelf holds XP, X′, X⁰, a triangle phrase, words, labels and a row of category chips
  (X, C, T, v, V, D, N, P, A, Adv, or type your own). Drag a piece just under another to hang it there, or just above a
  top node to make it the parent. Drag a node away to pull it off. Drop a category chip on a node to rename it (keeping its
  level). Drag a piece back onto the shelf to put it away. **Nudge** mode makes dragging only slide a node, for fine spacing.
- **Or paste it.** The **{ } LaTeX / text** button shows a text box: paste a labelled bracketing
  (`[S [NP [N Pat]] [VP [V sleeps]]]`) or LaTeX (`\Tree [.S ...]`, qtree or forest) and the tree appears. The box follows
  whatever you do on the drawing, and can be switched between brackets, qtree, forest and TikZ.
- **Edit it.** Double-click to retype a node, collapse a phrase to a triangle, cross text out, add or delete nodes
  (the bar next to the selected node has Delete), and draw **movement arrows** by dragging the green dot on a node onto
  the node it moved to. Several trees can sit on one page.

Labels take `_i`, `^0`, `V'` → V′, `\emph{}`, `\textbf{}`, `\sout{}` and Greek such as `\phi`.
Fonts, sizes, bold/italic and colour are set separately for labels and for words, and any node can override them.
Line width, spacing and arrow styling are adjustable.

## Keyboard

Press **?** (or the **Keys** button) for the full list. The main ones: arrows walk the tree; **Tab** / **F1** add a
daughter, **Shift+Tab** / **F2** a mother, **Enter** a sister; **Delete** removes; **R** retypes; **T** triangle;
**A** movement arrow; **Alt+arrows** nudge; **Ctrl+Z** undoes.

## Getting it out

- **SVG, PNG (150–600 dpi), PDF** (via print), in real point sizes.
- **TikZ.** The TikZ tab (and a standalone `.tex` download) writes every position, triangle and arrow out exactly, so what
  you see is what compiles.
- **forest** carries arrows as `\draw` lines on named nodes (forest lays the tree out itself). **qtree** cannot carry arrows.
- **A `.json` file** keeps positions, arrows and styles so you can reopen the tree later.

SVG text is saved as text in the fonts you chose, so it looks right only where those fonts are installed. PNG and PDF are
made on your own computer and are safe to send.

## Running it yourself

Download the repository and open `index.html`, or serve the folder from anything at all. It has no back end and no
dependencies. Your work is saved in your browser only.

## Licence

MIT, see `LICENSE`.
