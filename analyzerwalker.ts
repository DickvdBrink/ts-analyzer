/// <reference path="lib/typescriptServices.d.ts" />

class AnalyzerWalker extends TypeScript.SyntaxWalker {
    private position = 0;
    public errors: { error: string; line: number; col: number }[] = [];

    constructor(private syntaxTree: TypeScript.SyntaxTree, private ls: ts.LanguageService) {
        super();
    }

    private fileName() {
        return this.syntaxTree.fileName();
    }

    visitToken(token: TypeScript.ISyntaxToken): void {
        this.position += token.fullWidth();
        super.visitToken(token);
    }

    visitMemberFunctionDeclaration(node: TypeScript.MemberFunctionDeclarationSyntax): void {
        var isPrivate = TypeScript.SyntaxUtilities.containsToken(node.modifiers, TypeScript.SyntaxKind.PrivateKeyword);
        if (!isPrivate) {
            super.visitMemberFunctionDeclaration(node);
            return;
        }

        var propertyNode = <TypeScript.ISyntaxToken> node.propertyName;
        var name = propertyNode.text();
        var position = this.position + TypeScript.fullWidth(node.modifiers) + propertyNode.leadingTriviaWidth();

        var references = this.ls.getReferencesAtPosition(this.fileName(), position);
        if (references.length == 1) {
            this.addError("Unused method: " + name, position);
        }

        this.checkUnusedParameters(node.callSignature.parameterList);
        super.visitMemberFunctionDeclaration(node);
    }

    private checkUnusedParameters(node: TypeScript.ParameterListSyntax) {
        var position = node.openParenToken.fullStart() + node.openParenToken.fullWidth();

        for (var i = 0; i < node.parameters.length; i++) {
            var child = <TypeScript.ParameterSyntax><any> node.parameters[i];
            if (child.kind == TypeScript.SyntaxKind.CommaToken) {
                position += TypeScript.fullWidth(child);
                continue;
            }
            var references = this.ls.getReferencesAtPosition(this.fileName(), position + child.identifier.leadingTriviaWidth());
            if (references.length == 1) {
                this.addError("Unused parameter: " + child.identifier.text(), position + child.identifier.leadingTriviaWidth())
            }

            position += TypeScript.fullWidth(child);
        }
    }

    visitVariableDeclarator(node: TypeScript.VariableDeclaratorSyntax): void {
        var propertyNode = <TypeScript.ISyntaxToken> node.propertyName;
        var name = propertyNode.text();
        var position = this.position + propertyNode.leadingTriviaWidth();

        var references = this.ls.getReferencesAtPosition(this.fileName(), position);

        if (!references || references.length == 0) {
            this.addError("visitVariableDeclarator references.length == 0 " + name, position);
            super.visitVariableDeclarator(node);
            return;
        }

        if (references.length == 1) {
            this.addError("Unused variable: " + name, position);
        }

        super.visitVariableDeclarator(node);
    }

    private addError(error: string, position: number) {
        var errorPos = this.getLineFromPosition(position);
        this.errors.push({
            error: error,
            line: errorPos.line(),
            col: errorPos.character()
        });
    }

    private getLineFromPosition(position?: number) {
        if (position == undefined) {
            position = this.position;
        }
        var linemap = this.syntaxTree.lineMap();
        return linemap.getLineAndCharacterFromPosition(position);
    }
}