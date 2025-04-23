import Box from "@mui/material/Box";
import { MenuNonNull } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";
import Datagrid from "../../common/datagrid/Datagrid";

interface MenuFormProps {
  menus: MenuNonNull[];
}

const MenuForm = (props: MenuFormProps) => {
  return (
    <Box sx={{ marginTop: 1, paddingX: 1, height: "80vh" }}>
      <Datagrid
        items={props.menus}
        getRowId={({ data }) => data.menuId.toString()}
        singleClickEdit
        columnDefs={[
          {
            headerName: "ID",
            field: "menuId",
            filter: true,
            sortable: true,
            width: 100,
            hide: true,
          },
          {
            headerName: "Icona",
            field: "icon",
            filter: true,
            sortable: true,
            width: 200,
            editable: true,
          },
          {
            headerName: "Titolo",
            field: "title",
            filter: true,
            sortable: true,
            width: 200,
            editable: true,
          },
          {
            headerName: "View",
            field: "viewName",
            filter: true,
            sortable: true,
            width: 200,
          },
          {
            headerName: "Path",
            field: "path",
            filter: true,
            sortable: true,
            width: 200,
          },
          {
            headerName: "Menu padre",
            field: "parentMenuId",
            filter: true,
            sortable: true,
            width: 200,
          },
          {
            headerName: "Visibile",
            field: "isVisible",
            filter: true,
            sortable: true,
            width: 200,
          },
        ]}
      />
    </Box>
  );
};

export default MenuForm;
