namespace DueD.Helpers
{
    public class EventMessage
    {
        public string Id { get; set; }
        public IEntity? Entity { get; set; }
        public string? SubscriptionName { get; set; }
        public int UserId { get; set; }


        public EventMessage()
        {
            Id = Guid.NewGuid().ToString();

            UserId = 0;
        }
    }
}
