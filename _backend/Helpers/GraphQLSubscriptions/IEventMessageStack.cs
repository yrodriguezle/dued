using System.Collections.Concurrent;

namespace DueD.Helpers
{
    public interface IEventMessageStack
    {
        IObservable<EventMessage> GetEventMessageSubject();
        EventMessage AddEventMessage(EventMessage eventMessage);
    }
}
