var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// Serwowanie plików statycznych z wwwroot
app.UseDefaultFiles();   // automatycznie szuka index.html
app.UseStaticFiles();    // serwuje CSS/JS

app.Run();
