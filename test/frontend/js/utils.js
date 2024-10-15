const limitForExport = 1000;
// const limitForExport = 500;
// const tee = (s) => { console.log(s); return s; };
export const fullExportAction = (e, dt, button, config) => {
    const numRecordsToExport = dt.context[0].json.recordsFiltered;
    if (numRecordsToExport > limitForExport) {
        alert(`I can't export more than ${limitForExport} rows`);
        button[0].classList.remove("processing");
        return;
    }
    console.log(numRecordsToExport);
    const stopProcessing = () => {
        button[0].classList.remove("processing");
    };
    const self = this;
    const oldStart = dt.settings()[0]._iDisplayStart;
    dt.one('preXhr', (e, s, data) => {
        // Just this once, load all data from the server...
        data.start = 0;
        // data.length = 2147483647;
        data.length = -1;
        dt.one('preDraw', function (e, settings) {
            // Call the original action function
            if (button[0].className.indexOf('buttons-copy') >= 0) {
                $.fn.dataTable.ext.buttons.copyHtml5.action.call(self, e, dt, button, config, stopProcessing);
            }
            else if (button[0].className.indexOf('buttons-excel') >= 0) {
                $.fn.dataTable.ext.buttons.excelHtml5.action.call(self, e, dt, button, config, stopProcessing);
            }
            else if (button[0].className.indexOf('buttons-csv') >= 0) {
                $.fn.dataTable.ext.buttons.csvHtml5.action.call(self, e, dt, button, config, stopProcessing);
            }
            dt.one('preXhr', (e, s, data) => {
                settings._iDisplayStart = oldStart;
                data.start = oldStart;
            });
            // Reload the grid with the original page. Otherwise, API functions like table.cell(this) don't work properly.
            setTimeout(dt.ajax.reload, 0);
            // Prevent rendering of the full data to the DOM
            return false;
        });
    });
    // Requery the server with the new one-time export settings
    dt.ajax.reload();
};
