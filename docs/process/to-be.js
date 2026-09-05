/*
 * Процесс ВКР «как надо» — с автоматизацией в ВКР-трекере.
 * Вход в проверки универсальный: PDF работы (Word, Typst — не важно) и архив с кодом.
 * Запуск: node to-be.js  →  vkr-process-to-be.bpmn
 */
const fs = require('fs');
const { createModel } = require('./lib/bpmn-builder');

const m = createModel({
  id: 'Definitions_VKR_ToBe',
  poolName: 'Кафедра: выполнение и защита ВКР с ВКР-трекером',
  processName: 'Выполнение и защита ВКР («как надо»)',
  diagramName: 'Процесс ВКР — как надо',
  collaborationDoc: 'Целевой процесс: маршрут ведёт ВКР-трекер, проверки литературы, кода и текста автоматизированы.',
  processDoc: 'Модель «как надо»: цикл открывает заместитель заведующего по учебной части — выбирает окна регламента и даты, дальше сроки и напоминания ведёт система; каталог тем и приказ формируются автоматически, источники проходят рефчекер с выдачей описания по ГОСТ Р 7.0.5-2008, код приходит архивом и проверяется LLM, текст принимается в PDF и разбирается автоматически плюс сверяется LLM с методичкой. За людьми остаются антиплагиат, просмотры, предзащита, подписи и защита.',
  lanes: [
    { id: 'Lane_Deputy',    name: 'Заместитель заведующего по учебной части', rows: 1 },
    { id: 'Lane_Secretary', name: 'Секретарь кафедры', rows: 2 },
    { id: 'Lane_Teacher',   name: 'Руководитель ВКР', rows: 2 },
    { id: 'Lane_Student',   name: 'Студент', rows: 2 },
    { id: 'Lane_System',    name: 'ВКР-трекер: автопроверки, LLM, уведомления', rows: 2 },
    { id: 'Lane_Board',     name: 'Другие преподаватели (просмотры, предзащита, защита)', rows: 2 },
    { id: 'Lane_Norm',      name: 'Нормоконтролёр', rows: 1 },
    { id: 'Lane_Head',      name: 'Заведующий кафедрой', rows: 1 },
  ],
});
const { node: N, flow: F } = m;

/* Этап 1. Каталог тем */
N('StartEvent_Cycle', 'start', 'Начался новый учебный год', 'Lane_Deputy', 0, 0);
N('Task_InitCycle', 'user', 'Запустить цикл: выбрать окна регламента и даты', 'Lane_Deputy', 1, 0,
  { doc: 'Заместитель заведующего по учебной части открывает цикл в системе: выбирает окна регламента и при необходимости правит конкретные даты.' });
N('Task_ScheduleCalendar', 'service', 'Расставить сроки этапов и напоминания', 'Lane_System', 2, 0,
  { doc: 'Система раскладывает даты по этапам, ставит дедлайны и планирует напоминания студентам, руководителям и рецензентам.' });
N('Note_Deputy', 'note', 'Даты берутся из окон регламента; правки замзава пересчитывают сроки', 'Lane_System', 1, 1);
N('SubProcess_DateChange', 'sub', 'Изменение дат по ходу цикла', 'Lane_Deputy', 9, 0, { dx: -20 });
N('Task_SuggestTopics', 'service', 'Предложить темы прошлых лет к переносу', 'Lane_System', 3, 0,
  { doc: 'Трекер поднимает темы прошлых лет и предлагает руководителю перенести их в новый цикл.' });
N('Task_CollectTopics', 'user', 'Подтвердить перенос и вписать темы на выбор', 'Lane_Teacher', 4, 0,
  { doc: 'Первый круг таблицы: преподаватели с дипломниками вписывают темы на выбор, без фамилий студентов.' });
N('Task_PublishCatalog', 'service', 'Опубликовать каталог тем и уведомить студентов', 'Lane_System', 5, 0);
N('Task_StudentReview', 'user', 'Изучить каталог и связаться с преподавателем', 'Lane_Student', 6, 0);
N('Gateway_TopicChoice', 'xor', 'Как определяется тема?', 'Lane_Student', 7, 0);
N('Task_PickTopic', 'user', 'Закрепить тему из каталога', 'Lane_Student', 8, 0);
N('Task_NewTopic', 'user', 'Предложить свою тему', 'Lane_Student', 8, 1);
N('Task_AdjustTopic', 'user', 'Уточнить формулировку под специфику', 'Lane_Teacher', 8, 1);
N('Gateway_TopicJoin', 'xor', '', 'Lane_Student', 9, 0);
N('Task_SubmitStudent', 'user', 'Подать студента и итоговую тему', 'Lane_Teacher', 10, 0,
  { doc: 'Второй круг: преподаватель указывает фамилию студента и формулировку темы, которая пойдёт в диплом.' });
N('Note_Submit', 'note', 'Второй круг: фамилия студента и формулировка для диплома', 'Lane_Student', 10, 1);

/* Этап 2. Приказ */
N('Task_GenOrder', 'service', 'Собрать проект приказа из поданных пар', 'Lane_System', 11, 0,
  { doc: 'Проект приказа собирается автоматически из пар «студент — тема»: номера тем, руководители, шифры ВКР. До подписи это проект.' });
N('DataObj_OrderDraft', 'data', 'Проект приказа', 'Lane_System', 11, 1);
N('Task_CheckOrder', 'send', 'Проверить проект и отправить в ректорат', 'Lane_Secretary', 12, 0);
N('Event_OrderReply', 'msgin', 'Ответ из ректората', 'Lane_Secretary', 13, 0);
N('Task_FixTopic', 'user', 'Исправить формулировку темы', 'Lane_Teacher', 13, 1);
N('Gateway_Signed', 'xor', 'Проект подписан?', 'Lane_Secretary', 14, 0);
N('Task_NotifyFix', 'service', 'Уведомить руководителя о замечании и поставить срок', 'Lane_System', 14, 1);
N('Task_PublishOrder', 'user', 'Опубликовать приказ и зафиксировать статусы тем', 'Lane_Secretary', 15, 0);
N('DataObj_Order', 'data', 'Приказ об утверждении тем', 'Lane_Secretary', 15, 1);
N('Event_OrderPublished', 'throw', 'Темы утверждены приказом', 'Lane_Secretary', 16, 0);
N('SubProcess_TopicChange', 'sub', 'Смена темы после приказа (по заявлению)', 'Lane_Student', 16, 1, { dx: -32 });
m.subprocess('SubProcess_DateChange', {
  start: 'Нужно подвинуть дату',
  tasks: ['Выбрать этап и новое окно регламента', 'Пересчитать сроки и разослать уведомления'],
  end: 'Даты обновлены',
});
m.subprocess('SubProcess_TopicChange', {
  start: 'Нужна смена темы',
  tasks: ['Подать заявление на смену темы в системе', 'Согласовать новую тему с руководителем', 'Внести изменение в приказ'],
  end: 'Тема изменена',
});

/* Этап 3. Источники, просмотры, код */
N('Event_EndSemester', 'timer', 'Конец первого семестра', 'Lane_Student', 17, 0);
N('Task_AddSource', 'user', 'Добавить источник: ссылку, DOI или ISBN', 'Lane_Student', 18, 0);
N('Note_Refchecker', 'note', 'Готовая строка вставляется и в Word, и в Typst — формат работы не важен', 'Lane_Norm', 18, 0);
N('Task_RefResolve', 'service', 'Рефчекер: найти метаданные и собрать описание по ГОСТ', 'Lane_System', 19, 0,
  { doc: 'Система тянет метаданные по DOI, ISBN или URL и отдаёт студенту готовое библиографическое описание по ГОСТ Р 7.0.5-2008 — его остаётся вставить в свой список литературы.' });
N('Task_RefCheck', 'service', 'Проверить состав списка источников', 'Lane_System', 20, 0,
  { doc: 'Требования методички: не менее 30 источников, не менее 20 % зарубежных, обязательные базы — библиотека вуза, eLIBRARY, Scopus, интернет-источники. Ссылки в тексте сверяются позже, при разборе PDF.' });
N('DataObj_Sources', 'data', 'Список источников по ГОСТ', 'Lane_System', 20, 1);
N('Gateway_BibOk', 'xor', 'Список соответствует требованиям?', 'Lane_System', 21, 0);
N('Task_AddMore', 'user', 'Дополнить список источников', 'Lane_Student', 21, 1);
N('Note_RefRules', 'note', '30+ источников, 20 % зарубежных, обязательные базы', 'Lane_Head', 21, 0);
N('Task_ReviewersPick', 'service', 'Подобрать рецензентов: шаффл без повторов или предпочтения руководителя', 'Lane_System', 22, 0);
N('Task_NotifyScreening', 'service', 'Разослать приглашения на просмотр и напоминания', 'Lane_System', 23, 0);
N('Event_Screen1Date', 'timer', 'Зима: первый просмотр', 'Lane_Board', 24, 0);
N('Task_Screening1', 'user', 'Просмотр № 1: оценка и комментарии в системе', 'Lane_Board', 25, 0,
  { doc: 'Два преподавателя, не руководитель студента. В карточке просмотра — оценка, комментарий и контакт для консультации.' });
N('Note_Screen', 'note', 'Оценка, комментарий и контакт фиксируются в карточке просмотра', 'Lane_Norm', 25, 0);
N('Note_Window', 'note', 'Просмотр — окно в несколько дней: за это время студент и два преподавателя должны встретиться и выставить оценку', 'Lane_Norm', 23, 0);
N('Note_PredefDay', 'note', 'Предзащита — один день, внутри слоты по времени', 'Lane_Norm', 42, 0);
N('Boundary_Screen1', 'boundary', 'Окно закрылось', 'Lane_Board', 25, 0, { attachedTo: 'Task_Screening1', side: 'top', dx: 42 });
N('Event_Screen2Date', 'timer', 'Весна: второй просмотр', 'Lane_Board', 26, 0);
N('Task_Screening2', 'user', 'Просмотр № 2: оценка и комментарии в системе', 'Lane_Board', 27, 0);
N('Boundary_Screen2', 'boundary', 'Окно закрылось', 'Lane_Board', 27, 0, { attachedTo: 'Task_Screening2', side: 'top', dx: 42 });
N('Gateway_LateMerge', 'xor', '', 'Lane_System', 28, 1);
N('Task_RemindLate', 'service', 'Напомнить студенту, преподавателю и замзаву', 'Lane_System', 29, 1,
  { doc: 'Окно просмотра — интервал дней. Если к его концу оценка не выставлена, трекер напоминает обеим сторонам и показывает просрочку заместителю заведующего.' });
N('EndEvent_Reminded', 'end', 'Просрочка отработана', 'Lane_System', 30, 1);
N('Event_BeforePredef', 'timer', 'Март–апрель: за 1–2 месяца до предзащиты', 'Lane_System', 28, 0);
N('Task_UploadCode', 'user', 'Загрузить архив с кодом', 'Lane_Student', 29, 0,
  { doc: 'Код сдаётся отдельным архивом: в пояснительную записку он не вкладывается.' });
N('DataObj_CodeZip', 'data', 'Архив с кодом', 'Lane_Student', 29, 1);
N('Task_LlmCodeReview', 'service', 'LLM-ревью кода: качество, стиль, соответствие заданию', 'Lane_System', 30, 0,
  { doc: 'Система распаковывает архив, разбирает проект и выдаёт замечания с привязкой к файлам и строкам.' });
N('Note_LlmCode', 'note', 'Код приходит архивом; замечания LLM проверяет и дополняет руководитель', 'Lane_Norm', 30, 0);
N('Task_TeacherReviewCode', 'user', 'Проверить замечания и дополнить своими', 'Lane_Teacher', 31, 0);
N('Task_FixCode', 'user', 'Устранить замечания по коду', 'Lane_Student', 32, 0);

/* Этап 4. Допуск */
N('Task_PrepareDocs', 'user', 'Заполнить титульный лист и задание по шаблонам', 'Lane_Student', 33, 0);
N('DataObj_Pdf', 'data', 'PDF пояснительной записки', 'Lane_Student', 33, 1);
N('Task_UploadPdf', 'user', 'Выгрузить работу в PDF и отправить на проверку', 'Lane_Student', 34, 0,
  { doc: 'Формат приёма единый — PDF: у большинства работа сделана в Word, у части в Typst или LaTeX.' });
N('Task_ParseWork', 'service', 'Разобрать PDF: разделы, поля, шрифты, интервалы, ссылки на источники', 'Lane_System', 35, 0,
  { doc: 'Детерминированная часть проверки: состав и порядок разделов, поля страницы, кегль и интервал, нумерация, наличие ссылки в тексте на каждый источник.' });
N('Note_Pdf', 'note', 'Единый вход — PDF: Word, Typst или LaTeX не различаются', 'Lane_Norm', 35, 0);
N('Task_LlmNormControl', 'service', 'LLM-нормоконтроль: содержание разделов по методичке', 'Lane_System', 36, 0,
  { doc: 'LLM сверяет содержание с методичкой: обязательный минимум по разделам, связность, соответствие темы, задания и выводов.' });
N('Note_LlmNorm', 'note', 'Формальное — разбором PDF, содержательное — LLM по методичке', 'Lane_Head', 36, 0);
N('Gateway_NormOk', 'xor', 'Замечания есть?', 'Lane_System', 37, 0);
N('Task_FixNorm', 'user', 'Устранить замечания и пересобрать PDF', 'Lane_Student', 37, 1);
N('Task_NormConfirm', 'user', 'Подтвердить результат проверки', 'Lane_Norm', 38, 0);
N('Note_NormConfirm', 'note', 'Нужен ли живой нормоконтролёр после LLM — открытый вопрос', 'Lane_Board', 38, 1);
N('Task_Antiplagiat', 'user', 'Проверить на антиплагиат и выдать справку', 'Lane_Norm', 39, 0,
  { doc: 'Остаётся ручной проверкой нормоконтролёра; справка подписывается отдельно.' });
N('Note_Plag', 'note', 'Антиплагиат остаётся ручной проверкой', 'Lane_Board', 39, 1);
N('Gateway_PlagOk', 'xor', 'Оригинальность достаточна?', 'Lane_Norm', 40, 0);
N('Task_FixText', 'user', 'Доработать текст работы', 'Lane_Student', 40, 1);
N('DataObj_PlagReport', 'data', 'Справка об антиплагиате', 'Lane_Head', 40, 0);
N('Task_CollectPackage', 'service', 'Собрать пакет документов', 'Lane_System', 41, 0,
  { doc: 'Титульный лист, задание и справка об антиплагиате собираются в системе; подписанный список литературы добавляется позже, перед сшиванием.' });

/* Этап 5. Предзащита, подписи, сшивание, защита */
N('Event_PredefDate', 'timer', 'Май: предзащита', 'Lane_Board', 42, 0);
N('Task_Predefense', 'user', 'Предзащита: три преподавателя очно смотрят работу', 'Lane_Board', 43, 0);
N('Gateway_Admitted', 'xor', 'Допущен к защите?', 'Lane_Board', 44, 0);
N('Task_FixAfterPre', 'user', 'Доработать по замечаниям предзащиты', 'Lane_Student', 44, 1);
N('Task_SendBibLibrary', 'send', 'Отправить список литературы в библиотеку', 'Lane_Student', 45, 0);
N('Event_BibSigned', 'msgin', 'Список литературы подписан', 'Lane_Student', 46, 0);
N('Task_BindWork', 'manual', 'Сшить работу', 'Lane_Student', 47, 0);
N('Task_HeadSign', 'user', 'Подписать сшитую работу', 'Lane_Head', 48, 0);
N('Task_Defense', 'user', 'Защита ВКР перед комиссией', 'Lane_Board', 49, 0);
N('EndEvent_Done', 'end', 'ВКР защищена, оценка выставлена', 'Lane_Board', 50, 0);
N('Note_Tracker', 'note', 'Трекер ведёт статусы и сроки: напоминания студенту, руководителю и рецензентам', 'Lane_System', 5, 1);

/* Потоки */
F('StartEvent_Cycle', 'Task_InitCycle');
F('Task_InitCycle', 'Task_ScheduleCalendar', '', 'hvh');
F('Task_ScheduleCalendar', 'Task_SuggestTopics');
F('Task_SuggestTopics', 'Task_CollectTopics', '', 'hvh');
F('Task_CollectTopics', 'Task_PublishCatalog', '', 'hvh');
F('Task_PublishCatalog', 'Task_StudentReview', '', 'hvh');
F('Task_StudentReview', 'Gateway_TopicChoice');
F('Gateway_TopicChoice', 'Task_PickTopic', 'тема из каталога');
F('Gateway_TopicChoice', 'Task_NewTopic', 'своя тема', 'hvh');
F('Gateway_TopicChoice', 'Task_AdjustTopic', 'корректировка', 'hvh');
F('Task_PickTopic', 'Gateway_TopicJoin');
F('Task_NewTopic', 'Gateway_TopicJoin', '', 'hvh');
F('Task_AdjustTopic', 'Gateway_TopicJoin', '', 'hvh');
F('Gateway_TopicJoin', 'Task_SubmitStudent', '', 'hvh');
F('Task_SubmitStudent', 'Task_GenOrder', '', 'hvh');
F('Task_GenOrder', 'Task_CheckOrder', '', 'hvh');
F('Task_CheckOrder', 'Event_OrderReply');
F('Event_OrderReply', 'Gateway_Signed');
F('Gateway_Signed', 'Task_PublishOrder', 'подписан');
F('Gateway_Signed', 'Task_NotifyFix', 'есть замечания', 'vh');
F('Task_NotifyFix', 'Task_FixTopic', '', 'hv');
F('Task_FixTopic', 'Task_GenOrder', '', 'hv');
F('Task_PublishOrder', 'Event_OrderPublished');
F('Event_OrderPublished', 'Event_EndSemester', '', 'hvh');
F('Event_EndSemester', 'Task_AddSource');
F('Task_AddSource', 'Task_RefResolve', '', 'hvh');
F('Task_RefResolve', 'Task_RefCheck');
F('Task_RefCheck', 'Gateway_BibOk');
F('Gateway_BibOk', 'Task_ReviewersPick', 'да');
F('Gateway_BibOk', 'Task_AddMore', 'нужны ещё источники', 'vh');
F('Task_AddMore', 'Task_AddSource', '', 'hv');
F('Task_ReviewersPick', 'Task_NotifyScreening');
F('Task_NotifyScreening', 'Event_Screen1Date', '', 'hvh');
F('Event_Screen1Date', 'Task_Screening1');
F('Boundary_Screen1', 'Gateway_LateMerge', '', 'vh');
F('Boundary_Screen2', 'Gateway_LateMerge', '', 'vh');
F('Gateway_LateMerge', 'Task_RemindLate');
F('Task_RemindLate', 'EndEvent_Reminded');
F('Task_Screening1', 'Event_Screen2Date');
F('Event_Screen2Date', 'Task_Screening2');
F('Task_Screening2', 'Event_BeforePredef', '', 'hvh');
F('Event_BeforePredef', 'Task_UploadCode', '', 'hvh');
F('Task_UploadCode', 'Task_LlmCodeReview', '', 'hvh');
F('Task_LlmCodeReview', 'Task_TeacherReviewCode', '', 'hvh');
F('Task_TeacherReviewCode', 'Task_FixCode', '', 'hvh');
F('Task_FixCode', 'Task_PrepareDocs');
F('Task_PrepareDocs', 'Task_UploadPdf');
F('Task_UploadPdf', 'Task_ParseWork', '', 'hvh');
F('Task_ParseWork', 'Task_LlmNormControl');
F('Task_LlmNormControl', 'Gateway_NormOk');
F('Gateway_NormOk', 'Task_NormConfirm', 'нет', 'hvh');
F('Gateway_NormOk', 'Task_FixNorm', 'да', 'vh');
F('Task_FixNorm', 'Task_UploadPdf', '', 'hv');
F('Task_NormConfirm', 'Task_Antiplagiat');
F('Task_Antiplagiat', 'Gateway_PlagOk');
F('Gateway_PlagOk', 'Task_CollectPackage', 'да', 'hvh');
F('Gateway_PlagOk', 'Task_FixText', 'нет', 'vh');
F('Task_FixText', 'Task_Antiplagiat', '', 'hv');
F('Task_CollectPackage', 'Event_PredefDate', '', 'hvh');
F('Event_PredefDate', 'Task_Predefense');
F('Task_Predefense', 'Gateway_Admitted');
F('Gateway_Admitted', 'Task_SendBibLibrary', 'допущен', 'hvh');
F('Task_SendBibLibrary', 'Event_BibSigned');
F('Event_BibSigned', 'Task_BindWork');
F('Gateway_Admitted', 'Task_FixAfterPre', 'на доработку', 'vh');
F('Task_FixAfterPre', 'Task_Predefense', '', 'hv');
F('Task_BindWork', 'Task_HeadSign', '', 'hvh');
F('Task_HeadSign', 'Task_Defense', '', 'hvh');
F('Task_Defense', 'EndEvent_Done');

/* Слияния */
m.insertMerge('Gateway_PredefMerge', 'Task_Predefense');
m.insertMerge('Gateway_PlagMerge', 'Task_Antiplagiat');
m.insertMerge('Gateway_PdfMerge', 'Task_UploadPdf');
m.insertMerge('Gateway_SourceMerge', 'Task_AddSource');
m.insertMerge('Gateway_OrderMerge', 'Task_GenOrder');

/* Внешние участники */
m.external({ id: 'Participant_Rectorate', name: 'Ректорат: подписание приказа', anchor: 'Task_CheckOrder', anchor2: 'Event_OrderReply', side: 'top' });
m.external({ id: 'Participant_Meta', name: 'Внешние источники метаданных: Crossref, eLIBRARY, каталоги библиотек', anchor: 'Task_RefResolve', anchor2: 'Task_RefResolve', side: 'bottom' });
m.external({ id: 'Participant_Library', name: 'Библиотека: проверка и подпись списка литературы', anchor: 'Task_SendBibLibrary', anchor2: 'Event_BibSigned', side: 'bottom' });
m.message({ id: 'MessageFlow_OrderOut', name: 'Проект приказа на подпись', src: 'Task_CheckOrder', tgt: 'Participant_Rectorate' });
m.message({ id: 'MessageFlow_OrderBack', name: 'Подписанный приказ или замечания', src: 'Participant_Rectorate', tgt: 'Event_OrderReply' });
m.message({ id: 'MessageFlow_MetaOut', name: 'Запрос по DOI, ISBN или URL', src: 'Task_RefResolve', tgt: 'Participant_Meta', dx: -34 });
m.message({ id: 'MessageFlow_MetaBack', name: 'Метаданные источника', src: 'Participant_Meta', tgt: 'Task_RefResolve', dx: 34 });
m.message({ id: 'MessageFlow_BibOut', name: 'Список литературы', src: 'Task_SendBibLibrary', tgt: 'Participant_Library' });
m.message({ id: 'MessageFlow_BibBack', name: 'Подписанный список', src: 'Participant_Library', tgt: 'Event_BibSigned' });

/* Пояснения и данные */
m.annotate('Task_InitCycle', 'Note_Deputy');
m.annotate('Task_PublishCatalog', 'Note_Tracker');
m.annotate('Task_SubmitStudent', 'Note_Submit');
m.annotate('Task_RefResolve', 'Note_Refchecker');
m.annotate('Task_RefCheck', 'Note_RefRules');
m.annotate('Task_Screening1', 'Note_Screen');
m.annotate('Event_Screen1Date', 'Note_Window');
m.annotate('Event_PredefDate', 'Note_PredefDay');
m.annotate('Task_LlmCodeReview', 'Note_LlmCode');
m.annotate('Task_ParseWork', 'Note_Pdf');
m.annotate('Task_LlmNormControl', 'Note_LlmNorm');
m.annotate('Task_NormConfirm', 'Note_NormConfirm');
m.annotate('Task_Antiplagiat', 'Note_Plag');
m.data('Task_GenOrder', 'DataObj_OrderDraft');
m.data('Task_PublishOrder', 'DataObj_Order');
m.data('Task_RefResolve', 'DataObj_Sources');
m.data('Task_UploadCode', 'DataObj_CodeZip');
m.data('Task_UploadPdf', 'DataObj_Pdf');
m.data('Task_Antiplagiat', 'DataObj_PlagReport');

/* Группы этапов */
m.group('Group_Stage1', 'Этап 1. Каталог тем и подача студентов', 'StartEvent_Cycle', 'Task_SubmitStudent');
m.group('Group_Stage2', 'Этап 2. Проект приказа и приказ', 'Gateway_OrderMerge', 'Event_OrderPublished');
m.group('Group_Stage3', 'Этап 3. Источники, просмотры, ревью кода', 'Event_EndSemester', 'Task_FixCode');
m.group('Group_Stage4', 'Этап 4. Допуск: нормоконтроль по PDF и антиплагиат', 'Task_PrepareDocs', 'Task_CollectPackage');
m.group('Group_Stage5', 'Этап 5. Предзащита, подписи и защита', 'Event_PredefDate', 'EndEvent_Done');

const { xml, problems, stats } = m.build();
fs.writeFileSync(__dirname + '/vkr-process-to-be.bpmn', xml);
console.log(problems.length ? 'ПРОБЛЕМЫ РАСКЛАДКИ:\n  ' + problems.join('\n  ') : 'Раскладка: пересечений нет');
console.log('to-be:', stats);
