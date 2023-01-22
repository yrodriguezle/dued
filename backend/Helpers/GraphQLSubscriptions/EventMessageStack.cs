
using System.Reactive.Linq;
using System.Reactive.Subjects;

namespace DueD.Helpers
{
    public class EventMessageStack : IEventMessageStack
    {
        private readonly ISubject<EventMessage> _messageStream = new Subject<EventMessage>();
        
        public EventMessageStack() {}

        public IObservable<EventMessage> GetEventMessageSubject()
        {
            return _messageStream.AsObservable();
        }

        public EventMessage AddEventMessage(EventMessage entityDetails)
        {
            _messageStream.OnNext(entityDetails);
            return entityDetails;
        }

        public void AddError(Exception exception)
        {
            _messageStream.OnError(exception);
        }
    }
}
