import { Call, List, Blank, Literal, Variable, exprData } from "./expr";

const sample1 = new Call(
    "if",
    [
        new Call("=", [new Variable("n"), new Literal("0", "int")]),
        new List([
            new Call(
                "print",
                [
                    new Literal("This literal has a comment", "str", exprData("A literal comment")),
                    new Literal("Some other long string to test line breaking", "str"),
                ],
                exprData("This is a call comment inside a list"),
            ),
            new Literal("1", "int"),
        ]),
        new Call("id", [
            new List(
                [
                    new Call("print", [new Blank()]),
                    new Call("*", [
                        new Variable("n"),
                        new Call("fact", [
                            new Call("-", [new Variable("n"), new Literal("1", "int")]),
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
    new Literal("42", "int"),
]);

export const SAMPLE_1 = sample1.validate();
export const SAMPLE_2 = sample2.validate();
