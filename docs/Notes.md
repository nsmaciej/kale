# Notes

## Vocabulary 

* canvas - The area on which all the expressions live.
* toy box - A list of programming primitives users can drag things from.
* editor - Canvas, expressions and all other state.
* do, block, group - A list of expressions to be executed one by one. progn.
* crate - A Rust library.

## New TextMetrics object in canvas

https://www.chromestatus.com/feature/5307344997056512

Since Chrome 77 it is ok to use

    * actualBondingBoxAscent
    * actualBondingBoxDescent
    * actualBondingBoxLeft
    * actualBondingBoxRight
    * width

## Settings that Kale should have

* What happens when you drag an expression onto a blank space? Either it should
  disappear or just stay there detached from the expression tree (maybe greyed
  out). Arguably the scratch behaviour makes it simpler to use the canvas
  as a clipboard of sorts.
* Theme - For start it would be nice to have three: "Scratch", "Pro" (inspired
  by normal editor themes) and "Academic" black and white theme.
* Toy box - The toy box is a Scratch-like list of basic programming primitives
  the user can pick from to simplify discovery. It should be hidden outside the
  Scratch mode.
* A rough 'compactness' setting which would decide how much 'visual sugar'
  should be applied for the sake of brevity.
* Since Kale will not be file oriented it would be nice if the function browser
  had some kind of Sublime Text mini map like preview of each function.

## Potential shortcuts

* Enter - Insert a new hole in the closest group ancestor (possibly already selected)
* Esc - Edit exit a modal interface or select next parent
* Space - Insert a new hole in the closest call ancestor (possibly already selected)
  In the future it might also interact with data structures like lists
* Arrow keys - should the meaning change on the 'direction' of the expression?
  It makes sense that up/down should move between siblings in group expressions,
  but left/right makes more sense for calls. I feel like thinking about this
  visually will be more helpful than thinking about the underlying AST, but it
  might make sense to test that.

## Selling points

* No syntax errors
* Because strings are completely separated from the structure of the program,
  i18n is a nice selling point (no need to worry about https://lord.io/blog/2019/text-editing-hates-you-too/)

## Inspirations

* Scratch on how to nicely render unique graphical elements and measure text
* Rust Xi editor on how to structure a project like this
* Yew Rust web framework on how to use the stdweb library well
* Visual Studio Code for inspiration on modern programming GUIs and editor APIs
* petgraph and rust-forest crates for working with graphs