// Vercel Edge Middleware — מגן על /admin ב-Basic Auth.
// הגדירו ב-Vercel (Project Settings > Environment Variables):
//   ADMIN_USER      = yossi        (אופציונלי, ברירת מחדל yossi)
//   ADMIN_PASSWORD  = <הסיסמה שלכם>  (חובה)
// לאחר הגדרת המשתנים יש לבצע Redeploy כדי שייכנסו לתוקף.

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

export default function middleware(request) {
  const USER = process.env.ADMIN_USER || "yossi";
  const PASS = process.env.ADMIN_PASSWORD;

  // אם לא הוגדרה סיסמה - חוסמים גישה לגמרי (לא משאירים פתוח).
  if (!PASS) {
    return new Response(
      "ADMIN_PASSWORD is not configured. Set it in Vercel Environment Variables and redeploy.",
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const sep = decoded.indexOf(":");
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      if (user === USER && pass === PASS) {
        return; // מאושר - ממשיכים לדף המבוקש
      }
    }
  }

  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Coffee Admin", charset="UTF-8"' },
  });
}
