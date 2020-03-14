import { Call, List, Blank, Literal, Variable, exprData } from "expr";

const sample1 = new Call(
    "If",
    [
        new Call("=", [new Variable("n"), new Literal("0", "number")]),
        new List([
            new Call(
                "Print",
                [
                    new Literal(
                        "This literal has a comment",
                        "string",
                        exprData("A literal comment"),
                    ),
                    new Literal("Some other long string to test line breaking", "string"),
                ],
                exprData("This is a call comment inside a list"),
            ),
            new Literal("1", "number"),
        ]),
        new Call("Id", [
            new List(
                [
                    new Call("Print", [new Blank()]),
                    new Call("*", [
                        new Variable("n"),
                        new Call("fact", [
                            new Call("-", [new Variable("n"), new Literal("1", "number")]),
                        ]),
                    ]),
                ],
                exprData("This list has a comment of large width"),
            ),
        ]),
        new Call("sample-call-2", [new Blank(exprData("Missing argument"))]),
        new Call("sample-call"),
    ],
    exprData("Find a factorial of n. (https://example.com)"),
);

const sample2 = new Call("object", [
    new Literal("name", "symbol"),
    new Variable("name"),
    new Literal("age", "symbol"),
    new Literal("42", "number"),
    new Literal("long", "symbol"),
    new Literal("48557177334.32", "number"),
]);

const sample3 = new List([
    new Call("Let", [new Variable("msg"), new Literal("Hello World", "string")]),
    new Call("Print", [new Variable("msg")]),
]);

export const SAMPLE_1 = sample1.validate();
export const SAMPLE_2 = sample2.validate();
export const HELLO_WORLD = sample3.validate();
