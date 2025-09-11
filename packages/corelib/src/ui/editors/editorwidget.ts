import { getElementReadOnly, setElementReadOnly } from "../../base";
import { Widget, WidgetProps } from "../widgets/widget";

export type EditorProps<T> = WidgetProps<T> & {
    initialValue?: any;
    maxLength?: number;
    name?: string;
    placeholder?: string;
    required?: boolean;
    readOnly?: boolean;
}

export class EditorWidget<P> extends Widget<EditorProps<P>> {
    static override typeInfo = this.classType("Serenity.EditorWidget");

    constructor(props: EditorProps<P>) {
        super(props);
    }

    get readOnly(): boolean {
        return typeof (this as any)?.get_readOnly === "function" ? !!(this as any).get_readOnly() :
            getElementReadOnly(this.domNode);
    }

    set readOnly(value: boolean) {
        if (typeof (this as any)?.set_readOnly === "function") {
            (this as any).set_readOnly(!!value);
        }
        else if (this.domNode) {
            setElementReadOnly(this.domNode, value);
        }
    }
}
