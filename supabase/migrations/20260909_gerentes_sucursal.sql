-- Correos de gerentes de sucursal que aún no tienen cuenta en la plataforma.
-- Sirve como puente para que reciban los recordatorios de captura por correo
-- mientras se les da de alta como usuarios.
--
-- Cuando un gerente ya tenga cuenta con su rol y sucursal, se puede borrar
-- su fila de aquí: el endpoint lo tomará de `profiles` como a los demás.

CREATE TABLE IF NOT EXISTS public.gerentes_sucursal (
    sucursal     TEXT PRIMARY KEY,
    nombre       TEXT,
    email        TEXT NOT NULL,
    activo       BOOLEAN NOT NULL DEFAULT true,
    ultimo_aviso TIMESTAMPTZ
);

ALTER TABLE public.gerentes_sucursal ENABLE ROW LEVEL SECURITY;

-- Sin políticas a propósito: contiene datos de contacto y solo debe leerla
-- el endpoint del recordatorio, que usa la service_role.
