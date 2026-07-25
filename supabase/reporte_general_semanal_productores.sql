-- Consulta base para el Reporte General Semanal de Productores.
-- Ejecuta este script en el editor SQL de Supabase.
create or replace function public.reporte_general_semanal_productores(
  p_semana integer,
  p_anio integer
)
returns table (
  productor_id uuid,
  productor text,
  total_cestas_enviadas bigint,
  total_americanas_empacadas bigint,
  total_hindu_empacadas bigint,
  total_empacadas bigint,
  fecha_inicio date,
  fecha_fin date
)
language sql
stable
as $$
  select
    r.productor_id,
    coalesce(p.nombre, 'SIN NOMBRE') as productor,
    coalesce(sum(d.cestas_a + d.cestas_h), 0)::bigint as total_cestas_enviadas,
    coalesce(sum(d.americana_4 + d.americana_5 + d.americana_7), 0)::bigint as total_americanas_empacadas,
    coalesce(sum(d.hindu_4 + d.hindu_5 + d.hindu_7), 0)::bigint as total_hindu_empacadas,
    coalesce(sum(d.americana_4 + d.americana_5 + d.americana_7 + d.hindu_4 + d.hindu_5 + d.hindu_7), 0)::bigint as total_empacadas,
    min(r.fecha_inicio) as fecha_inicio,
    max(r.fecha_fin) as fecha_fin
  from public.reportes r
  inner join public.productores p on p.id = r.productor_id
  left join public.detalle_reporte d on d.reporte_id = r.id
  where r.semana = p_semana
    and r.anio = p_anio
  group by r.productor_id, p.nombre
  order by p.nombre;
$$;

grant execute on function public.reporte_general_semanal_productores(integer, integer) to authenticated;
