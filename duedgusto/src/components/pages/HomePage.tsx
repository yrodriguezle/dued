import useFetchData from "../../graphql/common/useFetchData";
import userSearchboxOption from "../common/form/searchbox/searchboxOptions/userSearchboxOptions";
import useSearchboxQueryParams from "../common/form/searchbox/useSearchboxQueryParams";

function HomePage() {
  const { query, variables } = useSearchboxQueryParams({
    options: userSearchboxOption,
    value: "super",
    fieldName: "userName",
  });

  useFetchData({
    query,
    variables,
    fetchPolicy: "cache-first",
  });
  return <div>HomePage</div>;
}

export default HomePage;
