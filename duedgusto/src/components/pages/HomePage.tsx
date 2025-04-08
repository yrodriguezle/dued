import { useState } from "react";
import Searchbox from "../common/form/searchbox/Searchbox";
import userSearchboxOption from "../common/form/searchbox/searchboxOptions/userSearchboxOptions";

function HomePage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [searchValue, setSearchValue] = useState("");
  return (
    <div style={{ padding: 20 }}>
      <h1>HomePage</h1>
      <Searchbox
        // Se non si utilizza il campo fieldName, allora name deve essere una chiave di User (in questo esempio "userName")
        name="userName"
        value={searchValue}
        orderBy="userName"
        options={userSearchboxOption}
      />
    </div>
  );
}

export default HomePage;
