// Path: web/modules/ui/search/index.js
import { SelectionHandler } from 'ui/search/selection_handler.js';
import { SearchSheet } from 'ui/search/search_sheet.js';
import { SearchRenderer } from 'ui/search/search_renderer.js';

export class SearchManager {
    constructor(contentLoader, contentRenderer) {
        this.contentLoader = contentLoader;
        this.contentRenderer = contentRenderer;

        this.sheet = new SearchSheet();
        this.renderer = new SearchRenderer(this.contentLoader, this.contentRenderer, this.sheet);
        this.selectionHandler = new SelectionHandler(this.renderer);
    }
}

