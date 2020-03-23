import React, { Component, ReactNode } from "react";
import styled from "styled-components";

import { Optional } from "utils";

const ErrorScreen = styled.div`
    font-size: 60px;
    color: ${(p) => p.theme.colour.error};
    padding: 60px 0 0 50px;
    font-weight: 700;
`;

export default class ErrorBoundary extends Component<
    { children: ReactNode },
    { error: Optional<Error> }
> {
    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    render() {
        return this.state?.error == null ? (
            this.props.children
        ) : (
            <ErrorScreen>Kale Stopped Working :(</ErrorScreen>
        );
    }
}
