update public.plans
set price_cents = 299,
    image_daily = 200,
    chat_daily = 4000,
    video_daily = 10,
    description = '前 6 个月每月 2.99 美元，之后每月 4.99 美元。每天 200 张图、4000 条问答、10 段视频。'
where code = 'launch';

update public.plans
set price_cents = 499,
    image_daily = 200,
    chat_daily = 4000,
    video_daily = 10,
    description = '每月 4.99 美元。每天 200 张图、4000 条问答、10 段视频。'
where code = 'monthly';
