export function GET(context: any) {
  return new Response(
    JSON.stringify({"foo": "fa"}, null, 2)
  );
}