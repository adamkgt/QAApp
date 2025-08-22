var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// Serwowanie plik�w statycznych z wwwroot
app.UseDefaultFiles();   // automatycznie szuka index.html
app.UseStaticFiles();    // serwuje CSS/JS

app.Run();
