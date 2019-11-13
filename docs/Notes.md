# Notes

## Vocabulary 

* canvas - The area on which all the expressions live.
* toy box - A list of programming primitives users can drag things from.
* editor - Canvas, expressions and all other state.

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