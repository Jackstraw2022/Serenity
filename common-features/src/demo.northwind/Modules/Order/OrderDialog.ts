import { EntityDialog } from "@serenity-is/corelib";
import { ReportHelper } from "@serenity-is/extensions";
import { OrderForm, OrderRow, OrderService } from "../ServerTypes/Demo";
import { nsDemoNorthwind } from "../ServerTypes/Namespaces";
import "./OrderDialog.css";

export class OrderDialog<P = {}> extends EntityDialog<OrderRow, P> {
    static override typeInfo = this.registerClass(nsDemoNorthwind);

    protected getFormKey() { return OrderForm.formKey; }
    protected getRowDefinition() { return OrderRow; }
    protected getService() { return OrderService.baseUrl; }

    protected form = new OrderForm(this.idPrefix);

    getToolbarButtons() {
        var buttons = super.getToolbarButtons();

        buttons.push(ReportHelper.createToolButton({
            title: 'Invoice',
            cssClass: 'export-pdf-button',
            reportKey: 'Northwind.OrderDetail',
            getParams: () => ({
                OrderID: this.entityId
            })
        }));

        return buttons;
    }

    protected updateInterface() {
        super.updateInterface();

        this.toolbar.findButton('export-pdf-button').toggle(this.isEditMode());
    }

    protected afterLoadEntity() {
        super.afterLoadEntity();
        this.form.DetailList.orderId = this.entityId;
    }
}