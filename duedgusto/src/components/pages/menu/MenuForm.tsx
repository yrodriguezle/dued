import { Field } from "formik";
import { MenuSearchbox } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";

const MenuForm = ({ onSelectItem }: { onSelectItem: (item: MenuSearchbox) => void }) => {
  return (
    <div>
      <Field name="menuName" placeholder="Nome menu" />
      <Field name="menuDescription" placeholder="Descrizione menu" />
    </div>
  );
};

export default MenuForm;
