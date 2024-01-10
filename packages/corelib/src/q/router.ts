﻿import { Fluent, closePanel, getjQuery, isArrayLike } from "@serenity-is/base";

export interface HandleRouteEvent extends Event {
    handled: boolean,
    route: string,
    parts: string[],
    index: number
}

export namespace Router {
    let oldURL: string;
    let resolving: number = 0;
    let autoinc: number = 0;
    let ignoreHash: number = 0;
    let ignoreTime: number = 0;

    export let enabled: boolean = true;

    function isEqual(url1: string, url2: string) {
        return url1 == url2 || url1 == url2 + '#' || url2 == url1 + '#';
    }

    export function navigate(hash: string, tryBack?: boolean, silent?: boolean) {
        if (!enabled || resolving > 0)
            return;

        hash = hash || '';
        hash = hash.replace(/^#/, '');
        hash = (!hash ? "" : '#' + hash);
        var newURL = window.location.href.replace(/#$/, '')
            .replace(/#.*$/, '') + hash;
        if (newURL != window.location.href) {
            if (tryBack && oldURL != null && isEqual(oldURL, newURL)) {
                if (silent)
                    ignoreChange();

                var prior = window.location.href;
                oldURL = null;
                window.history.back();
                return;
            }

            if (silent)
                ignoreChange();

            oldURL = window.location.href;
            window.location.hash = hash;
        }
    }

    export function replace(hash: string, tryBack?: boolean) {
        navigate(hash, tryBack, true);
    }

    export function replaceLast(hash: string, tryBack?: boolean) {
        if (!enabled)
            return;

        var current = window.location.hash || '';
        if (current.charAt(0) == '#')
            current = current.substr(1, current.length - 1);

        var parts = current.split('/+/');

        if (parts.length > 1) {
            if (hash && hash.length) {
                parts[parts.length - 1] = hash;
                hash = parts.join("/+/");
            }
            else {
                parts.splice(parts.length - 1, 1);
                hash = parts.join("/+/");
            }
        }
        replace(hash, tryBack);
    }

    function visibleDialogs() {
        var dialogs = document.querySelectorAll(".ui-dialog-content, .ui-dialog.panel-hidden>.ui-dialog-content, .s-PanelBody");
        var visibleDialogs: HTMLElement[] = [];
        dialogs.forEach((el: HTMLElement) => {
            if (!el.classList.contains(".ui-dialog-content") ||
                el.closest(".ui-dialog.panel-hidden"))
                visibleDialogs.push(el);
            if (el.offsetWidth > 0 && el.offsetHeight > 0)
                visibleDialogs.push(el);
        });
        visibleDialogs.sort((a: any, b: any) => {
            return parseInt(a.dataset.qrouterorder || "0", 10) - parseInt(b.dataset.qrouterorder || "0", 10);
        });
        return visibleDialogs;
    }

    function dialogOpen(owner: HTMLElement | ArrayLike<HTMLElement>, element: HTMLElement | ArrayLike<HTMLElement>, hash: () => string) {
        var route = [];
        owner = isArrayLike(owner) ? owner[0] : owner;
        element = isArrayLike(element) ? element[0] : element;
        var isDialog = owner.classList.contains(".ui-dialog-content") || owner.classList.contains('s-PanelBody');
        var dialog = isDialog ? owner : owner.closest('.ui-dialog-content, .s-PanelBody') as HTMLElement;
        var value = hash();

        var idPrefix: string;
        if (dialog) {
            var dialogs = visibleDialogs();
            var index = dialogs.indexOf(dialog);

            for (var i = 0; i <= index; i++) {
                var q = dialogs[i].dataset.qroute;
                if (q && q.length)
                    route.push(q);
            }

            if (!isDialog) {
                idPrefix = dialog.getAttribute("id");
                if (idPrefix) {
                    idPrefix += "_";
                    var id = owner.getAttribute("id");
                    if (id?.startsWith(idPrefix))
                        value = id.substring(idPrefix.length) + '@' + value;
                }
            }
        }
        else {
            var id = owner.getAttribute("id");
            if (id && (!owner.classList.contains("route-handler") ||
                document.querySelector('.route-handler')?.getAttribute("id") != id))
                value = id + "@" + value;
        }

        route.push(value);
        element.dataset.qroute = value;
        replace(route.join("/+/"));

        var el = element;
        var handler = (e: any) => {
            el.dataset.qroute = null;
            Fluent.off(el, ".qrouter");
            var prhash = el.dataset.qprhash;
            var tryBack = e.target.closest('.s-MessageDialog') || (e && e.originalEvent &&
                ((e.originalEvent.type == "keydown" && (e.originalEvent as any).keyCode == 27) ||
                    e.originalEvent.target.hasClass("ui-dialog-titlebar-close") ||
                    e.originalEvent.target.hasClass("panel-titlebar-close")));
            if (prhash != null)
                replace(prhash, tryBack);
            else
                replaceLast('', tryBack);
        }

        Fluent.on(element, "dialogclose.qrouter", handler);
        Fluent.on(element, "panelclose.qrouter", handler);
    }

    export function dialog(owner: HTMLElement | ArrayLike<HTMLElement>, element: HTMLElement | ArrayLike<HTMLElement>, hash: () => string) {
        if (!enabled)
            return;

        var el = isArrayLike(element) ? element[0] : element;
        if (!el)
            return;

        function handler() {
            dialogOpen(owner, el, hash);
        }

        Fluent.on(el, "dialogopen.qrouter", handler);
        Fluent.on(el, "panelopen.qrouter", handler);
    }

    export function resolve(hash?: string) {
        if (!enabled)
            return;

        resolving++;
        try {
            hash = hash ?? window.location.hash ?? '';
            if (hash.charAt(0) == '#')
                hash = hash.substr(1, hash.length - 1);

            var dialogs = visibleDialogs();
            var newParts = hash.split("/+/");
            var oldParts = dialogs.map((el: any) => el.dataset.qroute);

            var same = 0;
            while (same < dialogs.length &&
                same < newParts.length &&
                oldParts[same] == newParts[same]) {
                same++;
            }

            for (var i = same; i < dialogs.length; i++) {
                var d = dialogs[i];
                if (d.classList.contains('ui-dialog-content'))
                    getjQuery()(d as any).dialog?.('close');
                else if (d.classList.contains('s-PanelBody'))
                    closePanel(d);
            }

            for (var i = same; i < newParts.length; i++) {
                var route = newParts[i];
                var routeParts = route.split('@');
                var handler: HTMLElement;
                if (routeParts.length == 2) {
                    var dialog = i > 0 ? dialogs[i - 1] : null;
                    if (dialog) {
                        var idPrefix = dialog.getAttribute("id");
                        if (idPrefix) {
                            handler = document.querySelector('#' + idPrefix + "_" + routeParts[0]);
                            if (handler) {
                                route = routeParts[1];
                            }
                        }
                    }

                    if (!handler) {
                        handler = document.querySelector('#' + routeParts[0]);
                        if (handler) {
                            route = routeParts[1];
                        }
                    }
                }

                if (!handler) {
                    handler = i > 0 ? dialogs[i - 1] : document.querySelector('.route-handler');
                }

                Fluent.trigger(handler, "handleroute", <HandleRouteEvent>{
                    bubbles: false,
                    handled: false,
                    route: route,
                    parts: newParts,
                    index: i
                });
            }
        }
        finally {
            resolving--;
        }
    }

    function hashChange(e: any, o: string) {
        if (ignoreHash > 0) {
            if (new Date().getTime() - ignoreTime > 1000) {
                ignoreHash = 0;
            }
            else {
                ignoreHash--;
                return;
            }
        }
        resolve();
    }

    function ignoreChange() {
        ignoreHash++;
        ignoreTime = new Date().getTime();
    }

    window.addEventListener("hashchange", hashChange as any, false);

    let routerOrder = 1;

    if (typeof document !== "undefined") {
        function handler(event: any) {
            if (!enabled)
                return;

            var dlg = event.target as HTMLElement;
            dlg.dataset.qrouterorder = (routerOrder++).toString();

            if (dlg.dataset.qroute)
                return;

            dlg.dataset.qprhash = window.location.hash;
            var owner = visibleDialogs().filter(x => x !== dlg).pop();
            if (!owner)
                owner = document.documentElement;

            dialogOpen(owner, dlg, () => {
                return "!" + (++autoinc).toString(36);
            });
        }

        Fluent.on(document, "dialogopen", ".ui-dialog-content", handler);
        Fluent.on(document, "panelopen", ".s-PanelBody", handler);
    }
}