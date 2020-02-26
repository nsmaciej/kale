import * as E from "./expr";

const sampleExpr = new E.Call(
    "if",
    [
        new E.Call("=", [new E.Variable("n"), new E.Literal("0", "int")]),
        new E.List([
            new E.Call(
                "print",
                [
                    new E.Literal(
                        "This literal has a comment",
                        "str",
                        E.exprData("A literal comment"),
                    ),
                    new E.Literal("Some other long string to test line breaking", "str"),
                ],
                E.exprData("This is a call comment inside a list"),
            ),
            new E.Literal("1", "int"),
        ]),
        new E.Call("id", [
            new E.List(
                [
                    new E.Call("print", [new E.Hole()]),
                    new E.Call("*", [
                        new E.Variable("n"),
                        new E.Call("fact", [
                            new E.Call("-", [new E.Variable("n"), new E.Literal("1", "int")]),
                        ]),
                    ]),
                ],
                E.exprData("This list has a comment of large width"),
            ),
        ]),
        new E.Call("sample-call-2", [new E.Hole(E.exprData("Missing argument"))]),
        new E.Call("sample-call"),
    ],
    E.exprData("Find a factorial of n. (https://example.com)"),
);

sampleExpr.validate();
export default sampleExpr;
