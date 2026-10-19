-- admin-gate: «Кодоо мартсан» — verify.mn-ээр утсаа баталгаажуулж байх үеийн шат.
alter table public.data_gate_attempts drop constraint if exists data_gate_attempts_stage_check;
alter table public.data_gate_attempts add constraint data_gate_attempts_stage_check
  check (stage in ('phone', 'email', 'google', 'password', 'reset'));
