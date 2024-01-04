﻿import { Decorators } from "../../decorators";
import { IStringValue } from "../../interfaces";
import { EditorWidget, EditorProps } from "../widgets/widget";

// http://digitalbush.com/projects/masked-input-plugin/
@Decorators.registerEditor('Serenity.MaskedEditor', [IStringValue])
@Decorators.element("<input type=\"text\"/>")
export class MaskedEditor<P extends MaskedEditorOptions = MaskedEditorOptions> extends EditorWidget<P> {

    constructor(props: EditorProps<P>) {
        super(props);

        let input = $(this.domNode);
        (input as any).mask(this.options.mask || '', {
            placeholder: (this.options.placeholder ?? '_')
        });
    }

    public get value(): string {
        $(this.domNode).triggerHandler("blur.mask");
        return $(this.domNode).val() as string;
    }

    protected get_value(): string {
        return this.value;
    }

    public set value(value: string) {
        $(this.domNode).val(value);
    }

    protected set_value(value: string): void {
        this.value = value;
    }
}

export interface MaskedEditorOptions {
    mask?: string;
    placeholder?: string;
}