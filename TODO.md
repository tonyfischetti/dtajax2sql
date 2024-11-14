
- [ ] Use technique below to add type-of-search info
```javascript
ajax: {
  url: `${API_URL}/dtajax`,
  data: {
    arbData: "arbitrary data"
  }
}
```

- [ ] [GETTING THE ROW COUNT](https://datatables.net/examples/api/select_row.html)
- [ ] Maybe use a button for the above

- [ ] [React](https://datatables.net/manual/react)

- [ ] orderable (can be more than one column [with Shift])
- [ ] searchable
- [ ] [Column types ...Please note that ... (serverSide) this option has no effect since the ordering and search actions are performed by...](https://datatables.net/reference/option/columns.type)
- [ ] [Data rendering](https://datatables.net/examples/basic_init/data_rendering.html)
- [ ] [Compact](https://datatables.net/examples/styling/compact.html)
- [ ] [Column rendering](https://datatables.net/examples/advanced_init/column_render.html)
- [ ] Individual column searching

- [ ] Only works with AJAX _OBJECT_ data source
- [ ] Read only


- [ ] Test `getSelectClause`
- [ ] Protect against SQL injections
- [ ] Improve error handling all-around (`getSBBetween`, `getSBCriterionSql`, etc...)
- [ ] Document that "\!?between" is inclusive
- [ ] Test unicode
- [ ] Make `=` case-insensitive (for strings)





