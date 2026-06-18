// Fetch every row of a query, paging past PostgREST's 1000-row cap.
// Caller composes the filtered query and applies .range(from, to) per page.
const PAGE = 1000;

export async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await makeQuery(from, from + PAGE - 1);
    if (error) throw new Error(`Error al leer datos: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}
