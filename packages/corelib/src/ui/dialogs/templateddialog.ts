﻿import validator from "@optionaldeps/jquery.validation";
import { Config, DialogButton, bsModalMarkup, closePanel, defaultNotifyOptions, dialogButtonToBS, dialogButtonToUI, getInstanceType, openPanel, parseInteger, positionToastContainer } from "@serenity-is/base";
import { Decorators, FlexifyAttribute, MaximizableAttribute, PanelAttribute, ResizableAttribute, ResponsiveAttribute } from "../../decorators";
import { IDialog } from "../../interfaces";
import { getAttributes, isMobileView, layoutFillHeight, validateOptions } from "../../q";
import { TemplatedWidget } from "../widgets/templatedwidget";
import { ToolButton, Toolbar } from "../widgets/toolbar";
import { WidgetProps } from "../widgets/widget";
import { DialogExtensions } from "./dialogextensions";

@Decorators.registerClass('Serenity.TemplatedDialog', [IDialog])
export class TemplatedDialog<P> extends TemplatedWidget<P> {

    protected tabs: JQuery;
    protected toolbar: Toolbar;
    protected validator: JQueryValidation.Validator;

    constructor(props?: WidgetProps<P>) {
        super(props);

        this.domNode.classList.add("s-TemplatedDialog");
        this.domNode.setAttribute("id", this.domNode.getAttribute("id") || this.uniqueName);
        this.initValidator();
        this.initTabs();
        this.initToolbar();
    }

    static override createDefaultElement() {
        var div = document.body.appendChild(document.createElement("div"));
        div.classList.add("hidden");
        return div;
    }

    private get isMarkedAsPanel() {
        var panelAttr = getAttributes(getInstanceType(this),
            PanelAttribute, true) as PanelAttribute[];
        return panelAttr.length > 0 && panelAttr[panelAttr.length - 1].value !== false;
    }

    private get isResponsive() {
        return Config.responsiveDialogs ||
            getAttributes(getInstanceType(this), ResponsiveAttribute, true).length > 0;
    }

    private static getCssSize(element: JQuery, name: string): number {
        var cssSize = element.css(name);
        if (cssSize == null) {
            return null;
        }

        if (!cssSize.endsWith('px')) {
            return null;
        }

        cssSize = cssSize.substring(0, cssSize.length - 2);
        let i = parseInteger(cssSize);
        if (i == null || isNaN(i) || i == 0)
            return null;

        return i;
    }

    private static applyCssSizes(opt: any, dialogClass: string) {
        let size: number;
        let dialog = $('<div/>').hide().addClass(dialogClass).appendTo(document.body);
        try {
            var sizeHelper = $('<div/>').addClass('size').appendTo(dialog);
            size = TemplatedDialog.getCssSize(sizeHelper, 'minWidth');
            if (size != null)
                opt.minWidth = size;

            size = TemplatedDialog.getCssSize(sizeHelper, 'width');
            if (size != null)
                opt.width = size;

            size = TemplatedDialog.getCssSize(sizeHelper, 'height');
            if (size != null)
                opt.height = size;

            size = TemplatedDialog.getCssSize(sizeHelper, 'minHeight');
            if (size != null)
                opt.minHeight = size;
        }
        finally {
            dialog.remove();
        }
    };

    public destroy(): void {
        (this.tabs as any)?.tabs?.('destroy');
        this.tabs = null;
        (this.toolbar as any)?.toolbar?.destroy?.();
        this.toolbar = null;
        this.validator && this.byId('Form').remove();
        this.validator = null;
        if (this.domNode != null &&
            this.domNode.classList.contains('ui-dialog-content')) {
            ($(this.domNode) as any)?.dialog?.('destroy');
            $(this.domNode).removeClass('ui-dialog-content');
        }
        else if (this.domNode != null &&
            this.domNode.classList.contains('modal-body')) {
            var modal = $(this.domNode).closest('.modal').data('bs.modal', null);
            this.domNode && $(this.domNode).removeClass('modal-body');
            window.setTimeout(() => modal.remove(), 0);
        }

        $(window).unbind('.' + this.uniqueName);
        super.destroy();
    }

    protected initDialog(): void {
        if (this.domNode.classList.contains('ui-dialog-content'))
            return;

        $(this.domNode).removeClass('hidden');

        ($(this.domNode) as any)?.dialog?.(this.getDialogOptions());
        $(this.domNode).closest('.ui-dialog').on('resize', e => this.arrange());

        let type = getInstanceType(this);

        if (this.isResponsive) {
            DialogExtensions.dialogResizable($(this.domNode));

            $(window).bind('resize.' + this.uniqueName, e => {
                if (this.domNode && $(this.domNode).is(':visible')) {
                    this.handleResponsive();
                }
            });

            $(this.domNode).closest('.ui-dialog').addClass('flex-layout');
        }
        else if (DialogExtensions["dialogFlexify"] &&
            getAttributes(type, FlexifyAttribute, true).length > 0) {
            DialogExtensions["dialogFlexify"]($(this.domNode));
            DialogExtensions.dialogResizable($(this.domNode));
        }

        if (getAttributes(type, MaximizableAttribute, true).length > 0) {
            DialogExtensions.dialogMaximizable($(this.domNode));
        }

        var self = this;
        $(this.domNode).on('dialogopen.' + this.uniqueName, () => {
            $(document.body).addClass('modal-dialog-open');

            if (this.isResponsive) {
                this.handleResponsive();
            }

            self.onDialogOpen();
        });

        $(this.domNode).on('dialogclose.' + this.uniqueName, () => {
            $(document.body).toggleClass('modal-dialog-open', $('.ui-dialog:visible').length > 0);
            self.onDialogClose();
        });
    }

    protected getModalOptions(): ModalOptions {
        return {
            backdrop: false,
            keyboard: false,
            size: 'lg',
            modalClass: this.getCssClass()
        }
    }

    protected initModal(): void {
        if (this.domNode.classList.contains('modal-body'))
            return;

        var title = $(this.domNode).data('dialogtitle') ?? this.getDialogTitle() ?? '';
        var opt = this.getModalOptions();
        (opt as any)["show"] = false;
        var modalClass = "s-Modal";

        if (opt.modalClass)
            modalClass += ' ' + opt.modalClass;

        var div = bsModalMarkup(title, '', modalClass);
        var modal = $(div).appendTo(document.body).addClass('flex-layout');
        modal.one('shown.bs.modal.' + this.uniqueName, () => {
            $(this.domNode).triggerHandler('shown.bs.modal');
            this.onDialogOpen();
        });

        modal.one('hidden.bs.modal.' + this.uniqueName, () => {
            $(document.body).toggleClass('modal-open', $('.modal.show').length + $('.modal.in').length > 0);
            this.onDialogClose();
        });
        if (opt.size)
            modal.find('.modal-dialog').addClass('modal-' + opt.size);

        var footer = modal.find('.modal-footer');
        var buttons = this.getDialogButtons();
        if (buttons != null) {
            for (var x of buttons) {
                $(dialogButtonToBS(x)).appendTo(footer).click(x.click as any);
            }
        }
        else
            footer.hide();

        (modal as any).modal(opt);
        modal.find('.modal-body').replaceWith($(this.domNode).removeClass('hidden').addClass('modal-body'));
        $(window).on('resize.' + this.uniqueName, this.arrange.bind(this));
    }

    protected initToolbar(): void {
        var toolbarDiv = this.byId('Toolbar');
        if (toolbarDiv.length === 0) {
            return;
        }

        var hotkeyContext = $(this.domNode).closest('.ui-dialog');
        if (hotkeyContext.length === 0) {
            hotkeyContext = $(this.domNode).closest('.modal');
            if (hotkeyContext.length == 0)
                hotkeyContext = $(this.domNode);
        }

        this.toolbar = new Toolbar({ element:toolbarDiv, buttons: this.getToolbarButtons(), hotkeyContext: hotkeyContext[0] });
    }

    protected getToolbarButtons(): ToolButton[] {
        return [];
    }

    protected getValidatorOptions(): JQueryValidation.ValidationOptions {
        return {};
    }

    protected initValidator(): void {
        var form = this.byId('Form');
        if (form.length > 0) {
            var valOptions = this.getValidatorOptions();
            this.validator = (validator || form.validate) && form.validate(validateOptions(valOptions));
        }
    }

    protected resetValidation() {
        this.validator && (this.validator as any).resetAll();
    }

    protected validateForm() {
        return this.validator == null || !!this.validator.form();
    }

    public dialogOpen(asPanel?: boolean): void {
        asPanel = asPanel ?? this.isMarkedAsPanel;
        if (asPanel) {
            if (!this.domNode.classList.contains('s-Panel')) {
                // so that panel title is created if needed
                $(this.domNode).on('panelopen.' + this.uniqueName, () => {
                    this.onDialogOpen();
                });
                $(this.domNode).on('panelclose.' + this.uniqueName, () => {
                    this.onDialogClose();
                });
            }

            TemplatedDialog.openPanel(this.domNode, this.uniqueName);
            this.setupPanelTitle();
        }
        else if (this.useBSModal()) {
            this.initModal();
            ($(this.domNode).closest('.modal') as any).modal('show');
        }
        else {
            this.initDialog();
            ($(this.domNode) as any).dialog?.('open');
        }
    }

    private useBSModal() {
        return !!((!($ as any).ui || !($ as any).ui?.dialog) || TemplatedDialog.bootstrapModal);
    }

    public static bootstrapModal: boolean;

    public static openPanel(element: HTMLElement | ArrayLike<HTMLElement>, uniqueName: string) {
        return openPanel(element, uniqueName);
    }

    public static closePanel(element: HTMLElement | ArrayLike<HTMLElement>, e?: Event) {
        return closePanel(element, e);
    }

    protected onDialogOpen(): void {
        if (!isMobileView())
            $(':input', this.domNode).not('button').eq(0).focus();
        this.arrange();
        this.tabs && (this.tabs as any).tabs?.('option', 'active', 0);
    }

    public arrange(): void {
        $(this.domNode).find('.require-layout').filter(':visible').each(function (i, e) {
            $(e).triggerHandler('layout');
        });
    }

    protected onDialogClose() {
        $(document).trigger('click');

        // for tooltips etc.
        if (($ as any).qtip) {
            $(document.body).children('.qtip').each(function (index, el) {
                ($(el) as any).qtip('hide');
            });
        }

        window.setTimeout(() => {
            var element = $(this.domNode);
            this.destroy();
            element.remove();
            positionToastContainer(defaultNotifyOptions, false);
        }, 0);
    }

    protected addCssClass(): void {
        if (this.isMarkedAsPanel) {
            super.addCssClass();

            if (this.isResponsive)
                this.domNode.classList.add("flex-layout");
        }
    }

    protected getDialogButtons(): DialogButton[] {
        return undefined;
    }

    protected getDialogOptions(): any {
        var opt: any = {};
        var dialogClass = 's-Dialog ' + this.getCssClass();
        opt.dialogClass = dialogClass;
        var buttons = this.getDialogButtons();
        if (buttons != null)
            opt.buttons = buttons.map(dialogButtonToUI);
        opt.width = 920;
        TemplatedDialog.applyCssSizes(opt, dialogClass);
        opt.autoOpen = false;
        let type = getInstanceType(this);
        opt.resizable = getAttributes(type, ResizableAttribute, true).length > 0;
        opt.modal = true;
        opt.position = { my: 'center', at: 'center', of: $(window.window) };
        opt.title = $(this.domNode).data('dialogtitle') ?? this.getDialogTitle() ?? '';
        return opt;
    }

    protected getDialogTitle() {
        return "";
    }

    public dialogClose(): void {
        if (this.domNode.classList.contains('ui-dialog-content'))
            ($(this.domNode) as any).dialog?.().dialog?.('close');
        else if (this.domNode.classList.contains('modal-body'))
            ($(this.domNode).closest('.modal') as any).modal('hide');
        else if (this.domNode.classList.contains('s-Panel') && !this.domNode.classList.contains('hidden')) {
            TemplatedDialog.closePanel(this.domNode);
        }
    }

    public get dialogTitle(): string {
        if (this.domNode.classList.contains('ui-dialog-content'))
            return ($(this.domNode) as any).dialog?.('option', 'title');
        else if (this.domNode.classList.contains('modal-body'))
            return $(this.domNode).closest('.modal').find('.modal-header').children('h5').text();

        return $(this.domNode).data('dialogtitle');
    }

    private setupPanelTitle() {
        var value = this.dialogTitle ?? this.getDialogTitle();
        var pt = $(this.domNode).children('.panel-titlebar');

        if (!value) {
            pt.remove();
        }
        else {
            if (!$(this.domNode).children('.panel-titlebar').length) {
                pt = $("<div class='panel-titlebar'><div class='panel-titlebar-text'></div></div>")
                    .prependTo(this.domNode);
            }
            pt.children('.panel-titlebar-text').text(value);

            if (this.domNode.classList.contains('s-Panel')) {
                if (!pt.children('.panel-titlebar-close').length) {
                    $('<button class="panel-titlebar-close">&nbsp;</button>')
                        .prependTo(pt)
                        .click(e => {
                            TemplatedDialog.closePanel(this.domNode, e as any);
                        });
                }
            }
        }
    }

    public set dialogTitle(value: string) {
        var oldTitle = this.dialogTitle;
        $(this.domNode).data('dialogtitle', value);

        if (this.domNode.classList.contains('ui-dialog-content'))
            ($(this.domNode) as any).dialog?.('option', 'title', value);
        else if (this.domNode.classList.contains('modal-body')) {
            $(this.domNode).closest('.modal').find('.modal-header').children('h5').text(value ?? '');
        }
        else if (this.domNode.classList.contains('s-Panel')) {
            if (oldTitle != this.dialogTitle) {
                this.setupPanelTitle();
                this.arrange();
            }

        }
    }

    public set_dialogTitle(value: string) {
        this.dialogTitle = value;
    }

    protected initTabs(): void {
        var tabsDiv = this.byId('Tabs');
        if (tabsDiv.length === 0) {
            return;
        }
        this.tabs = (tabsDiv as any).tabs?.({});
        this.tabs.bind('tabsactivate', () => this.arrange());
    }

    protected handleResponsive(): void {
        var dlg = ($(this.domNode) as any)?.dialog();
        var uiDialog = $(this.domNode).closest('.ui-dialog');
        if (isMobileView()) {
            var data = $(this.domNode).data('responsiveData');
            if (!data) {
                data = {};
                data.draggable = dlg.dialog('option', 'draggable');
                data.resizable = dlg.dialog('option', 'resizable');
                data.position = dlg.css('position');
                var pos = uiDialog.position();
                data.left = pos.left;
                data.top = pos.top;
                data.width = uiDialog.width();
                data.height = uiDialog.height();
                data.contentHeight = $(this.domNode).height();
                $(this.domNode).data('responsiveData', data);
                dlg.dialog('option', 'draggable', false);
                dlg.dialog('option', 'resizable', false);
            }
            uiDialog.addClass('mobile-layout');
            uiDialog.css({ left: '0px', top: '0px', width: $(window).width() + 'px', height: $(window).height() + 'px', position: 'fixed' });
            $(document.body).scrollTop(0);
            layoutFillHeight(this.domNode);
        }
        else {
            var d = $(this.domNode).data('responsiveData');
            if (d) {
                dlg.dialog('option', 'draggable', d.draggable);
                dlg.dialog('option', 'resizable', d.resizable);
                $(this.domNode).closest('.ui-dialog').css({ left: '0px', top: '0px', width: d.width + 'px', height: d.height + 'px', position: d.position });
                $(this.domNode).height(d.contentHeight);
                uiDialog.removeClass('mobile-layout');
                $(this.domNode).removeData('responsiveData');
            }
        }
    }
}

export interface ModalOptions {
    backdrop?: boolean | 'static',
    keyboard?: boolean,
    size?: 'lg' | 'sm',
    modalClass?: string;
}