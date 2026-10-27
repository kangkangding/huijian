update public.plans
set image_daily = 10,
    chat_daily = 200,
    description = '每天 10 张图、200 条问答，适合先试一句。'
where code = 'free';

update public.plans
set image_daily = 100,
    chat_daily = 2000,
    description = '限时 1.9 元开通 30 天。每天 100 张图、2000 条问答、5 段视频。'
where code = 'launch';

update public.plans
set image_daily = 100,
    chat_daily = 2000
where code = 'monthly';
