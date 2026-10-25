alter table shops add column if not exists user_id text not null default '';
alter table shops add column if not exists audience text not null default 'self';

alter table menu_rows add column if not exists prev_price double precision;
alter table menu_rows add column if not exists observed_on text not null default '';
alter table menu_rows add column if not exists source_url text not null default '';

update shops set audience = 'owner' where id = 'shop-eirini' and audience = 'self' and user_id = '';

create table if not exists datanet_owners (
  user_id text primary key,
  email text not null default '',
  claimed_at timestamptz not null default now()
);
