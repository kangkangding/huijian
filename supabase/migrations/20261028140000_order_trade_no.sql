alter table public.orders add column if not exists out_trade_no text;
create unique index if not exists orders_out_trade_no_idx on public.orders (out_trade_no);
