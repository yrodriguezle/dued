using GraphQL.Types;

using duedgusto.Models;

namespace duedgusto.GraphQL.Authentication;

public class MenuType : ObjectGraphType<Menu>
{
    public MenuType()
    {
        Name = "Menu";
        Description = "Menu";
        Field(x => x.MenuId, typeof(IntGraphType));
        Field(x => x.Title, typeof(StringGraphType));
        Field(x => x.Path, typeof(StringGraphType));
        Field(x => x.Icon, typeof(StringGraphType));
        Field(x => x.IsVisible, typeof(BooleanGraphType));
        Field(x => x.FilePath, typeof(StringGraphType));
        Field(x => x.ViewName, typeof(StringGraphType));
        Field(x => x.IsVisible, typeof(BooleanGraphType));
        Field(x => x.ParentMenuId, typeof(IntGraphType));
    }
}
