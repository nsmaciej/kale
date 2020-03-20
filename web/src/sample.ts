import { Call, List, Blank, Literal, Variable, exprData } from "expr";
import { Type } from "vm/types";

const sample1 = new Call(
    "If",
    [
        new Call("=", [new Variable("n"), new Literal("0", Type.Num)]),
        new List([
            new Call(
                "Print",
                [
                    new Literal(
                        "This literal has a comment",
                        Type.Str,
                        exprData("A literal comment"),
                    ),
                    new Literal("Some other long string to test line breaking", Type.Str),
                ],
                exprData("This is a call comment inside a list"),
            ),
            new Literal("1", Type.Num),
        ]),
        new Call("Id", [
            new List(
                [
                    new Call("Print", [new Blank()]),
                    new Call("*", [
                        new Variable("n"),
                        new Call("fact", [
                            new Call("-", [new Variable("n"), new Literal("1", Type.Num)]),
                        ]),
                    ]),
                ],
                exprData("This list has a comment of large width"),
            ),
        ]),
        new Call("Sample-2", [new Blank(exprData("Missing argument"))]),
        new Call("Sample-1"),
    ],
    exprData("Find a factorial of n. (https://example.com)"),
);

//TODO: Add a symbol type.
const sample2 = new Call("object", [
    new Literal("name", "symbol"),
    new Variable("name"),
    new Literal("age", "symbol"),
    new Literal("42", Type.Num),
    new Literal("long", "symbol"),
    new Literal("48557177334.32", Type.Num),
]);

const sample3 = new List([
    new Call("Let", [new Variable("msg"), new Literal("Hello World", Type.Str)]),
    new Call("Print", [
        new Literal("This will not be printed", Type.Str, exprData(null, true)),
        new Variable("msg"),
    ]),
    new Call("Sample-1"),
]);

export const SAMPLE_1 = sample1.validate();
export const SAMPLE_2 = sample2.validate();
export const HELLO_WORLD = sample3.validate();
