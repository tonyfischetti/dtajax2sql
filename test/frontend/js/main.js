import { API_URL } from './constants.js';
import { columnDefs } from './columnDefs.js';
import { fullExportAction } from './utils.js';
const modal = document.getElementById("popup-modal");
// const modalClose = document.getElementById("modal-close");
const populateTable = () => {
    //  TODO  is it already populated?!!?!
    const table = $("#dt-table").DataTable({
        ordering: false,
        paging: true,
        pageLength: 10,
        pageResize: true,
        fixedHeader: true,
        ajax: `${API_URL}/dtajax`,
        serverSide: true,
        processing: true,
        select: true,
        deferRender: true,
        search: { return: true },
        searchBuilder: { enterSearch: true },
        layout: {
            top1: 'searchBuilder',
            topStart: {
                buttons: [
                    {
                        "extend": 'copy',
                        "action": fullExportAction
                    },
                    {
                        "extend": 'csv',
                        "action": fullExportAction
                    },
                    {
                        "extend": 'excel',
                        "action": fullExportAction
                    }
                ],
            }
        },
        columns: columnDefs,
    });
    console.log("I'm here");
    return table;
};
const handleClicks = (event) => {
    console.log("click event");
};
const start = () => {
    console.log("JS is working");
    Promise.resolve().
        then(populateTable);
    // then(tbl => {
    //   const data = tbl.buttons.exportData();
    //   console.log({data});
    // });
};
window.addEventListener('DOMContentLoaded', start);
window.addEventListener('click', handleClicks);
// modalClose.addEventListener('click', () => { modal.style.display = "none"; });
