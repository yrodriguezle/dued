import useFetchData from "../../graphql/common/useFetchData";
import roleSearchboxOptions from "../common/form/searchbox/searchboxOptions/roleSearchboxOptions";
import userSearchboxOption from "../common/form/searchbox/searchboxOptions/userSearchboxOptions";
import useSearchboxQueryParams from "../common/form/searchbox/useSearchboxQueryParams";

function HomePage() {
  const { query: qU, variables: vU } = useSearchboxQueryParams({
    options: userSearchboxOption,
    value: "super",
    fieldName: "userName",
  });

  useFetchData({
    query: qU,
    variables: vU,
    // fetchPolicy: "cache-first",
  });

  const { query: qR, variables: vR } = useSearchboxQueryParams({
    options: roleSearchboxOptions,
    value: "super",
    fieldName: "roleName",
  });

  useFetchData({
    query: qR,
    variables: vR,
    // fetchPolicy: "cache-first",
  });

  return <div>HomePage</div>;
}

export default HomePage;
