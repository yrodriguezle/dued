using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.DataAccess;
using duedgusto.Services.GraphQL;
using Microsoft.EntityFrameworkCore;

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
        Field<MenuType>("parentMenu").Resolve(context => context.Source.ParentMenu);
        Field<ListGraphType<MenuType>>("children").Resolve(context => context.Source.Children);
    }
}
