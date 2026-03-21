namespace duedgusto.Services.Events;

public interface IEventBus
{
    void Publish<T>(T eventData);
    IObservable<T> Subscribe<T>();
}
