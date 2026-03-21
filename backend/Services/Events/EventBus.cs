using System.Reactive.Subjects;

namespace duedgusto.Services.Events;

public class EventBus : IEventBus, IDisposable
{
    private readonly Dictionary<Type, object> _subjects = new();
    private readonly object _lock = new();

    public void Publish<T>(T eventData)
    {
        lock (_lock)
        {
            if (_subjects.TryGetValue(typeof(T), out var subject))
            {
                ((Subject<T>)subject).OnNext(eventData);
            }
        }
    }

    public IObservable<T> Subscribe<T>()
    {
        lock (_lock)
        {
            if (!_subjects.ContainsKey(typeof(T)))
            {
                _subjects[typeof(T)] = new Subject<T>();
            }
            return (Subject<T>)_subjects[typeof(T)];
        }
    }

    public void Dispose()
    {
        lock (_lock)
        {
            foreach (var subject in _subjects.Values)
            {
                ((IDisposable)subject).Dispose();
            }
            _subjects.Clear();
        }
    }
}
