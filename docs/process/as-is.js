/*
 * Процесс ВКР «как есть» — по разбору с кафедры.
 * Запуск: node as-is.js  →  vkr-process-as-is.bpmn
 */
const fs = require('fs');
const { createModel } = require('./lib/bpmn-builder');

const m = createModel({
  id: 'Definitions_VKR_AsIs',
  poolName: 'Кафедра: выполнение и защита ВКР',
  processName: 'Выполнение и защита ВКР («как есть»)',
  diagramName: 'Процесс ВКР — как есть',
  collaborationDoc: 'Сквозной процесс выпускной квалификационной работы: от таблицы тем до защиты.',
  processDoc: 'Модель «как есть»: график цикла ведёт заместитель заведующего по учебной части, таблица тем на выбор, подача пары «студент — итоговая тема», проект приказа и приказ через ректорат, библиография, зимний и весенний просмотры, ревью кода, нормоконтроль и антиплагиат, майская предзащита, подпись списка литературы в библиотеке, сшивание, подпись заведующего и защита.',
  lanes: [
    { id: 'Lane_Deputy',    name: 'Заместитель заведующего по учебной части', rows: 1 },
    { id: 'Lane_Secretary', name: 'Секретарь кафедры (таблица тем, приказ)', rows: 2 },
    { id: 'Lane_Teacher',   name: 'Руководитель ВКР (преподаватель студента)', rows: 2 },
    { id: 'Lane_Student',   name: 'Студент', rows: 2 },
    { id: 'Lane_Norm',      name: 'Нормоконтролёр (нормоконтроль и антиплагиат)', rows: 2 },
    { id: 'Lane_Head',      name: 'Заведующий кафедрой', rows: 1 },
    { id: 'Lane_Board',     name: 'Другие преподаватели (просмотры, предзащита, защита)', rows: 2 },
  ],
});
const { node: N, flow: F } = m;

/* Этап 1. Таблица тем и выбор темы */
N('StartEvent_Cycle', 'start', 'Начался новый учебный год', 'Lane_Deputy', 0, 0);
N('Task_PlanCalendar', 'user', 'Назначить даты просмотров, нормоконтроля и предзащиты', 'Lane_Deputy', 1, 0,
  { doc: 'Заместитель заведующего по учебной части ведёт весь график: назначает даты, рассылает их по кафедре, торопит отстающих и собирает статусы вручную.' });
N('Note_Deputy', 'note', 'График, напоминания и сбор статусов — вручную', 'Lane_Secretary', 1, 1);
N('Task_OpenTable', 'user', 'Собрать таблицу преподавателей с дипломниками', 'Lane_Secretary', 2, 0,
  { doc: 'В таблицу попадают преподаватели, у которых в этом году есть дипломники: каждый вписывает свои темы.' });
N('Task_CollectTopics', 'user', 'Вписать темы на выбор', 'Lane_Teacher', 3, 0,
  { doc: 'Темы предлагаются студентам на выбор: новые идеи, задачи с основного места работы и темы прошлых лет — их обычно больше половины.' });
N('Task_ShareTable', 'send', 'Разослать студентам ссылку на таблицу тем', 'Lane_Secretary', 4, 0);
N('Task_StudentReview', 'user', 'Изучить темы и связаться с преподавателем', 'Lane_Student', 5, 0);
N('Gateway_TopicChoice', 'xor', 'Как определяется тема?', 'Lane_Student', 6, 0);
N('Task_PickTopic', 'user', 'Выбрать тему из перечня', 'Lane_Student', 7, 0);
N('Task_NewTopic', 'user', 'Предложить свою тему', 'Lane_Student', 7, 1);
N('Task_AdjustTopic', 'user', 'Уточнить формулировку темы под специфику', 'Lane_Teacher', 7, 1,
  { doc: 'Общая тема из перечня дорабатывается вместе со студентом под конкретную задачу.' });
N('Gateway_TopicJoin', 'xor', '', 'Lane_Student', 8, 0);
N('Task_SubmitStudent', 'user', 'Подать студента и итоговую тему', 'Lane_Teacher', 9, 0,
  { doc: 'Второй круг таблицы: преподаватель указывает фамилию студента и ту формулировку темы, которая пойдёт в диплом.' });

/* Этап 2. Проект приказа и приказ */
N('Task_DraftOrder', 'user', 'Сформировать проект приказа', 'Lane_Secretary', 10, 0,
  { doc: 'Проект приказа собирается из поданных пар «студент — тема». До подписи это именно проект.' });
N('DataObj_OrderDraft', 'data', 'Проект приказа', 'Lane_Secretary', 10, 1);
N('Task_SendOrder', 'send', 'Отправить проект приказа на подпись в ректорат', 'Lane_Secretary', 11, 0);
N('Event_OrderReply', 'msgin', 'Ответ из ректората', 'Lane_Secretary', 12, 0);
N('Task_FixTopic', 'user', 'Исправить формулировку темы', 'Lane_Teacher', 12, 1);
N('Gateway_Signed', 'xor', 'Проект подписан?', 'Lane_Secretary', 13, 0);
N('Task_ReturnForFix', 'user', 'Вернуть тему на доработку и проконтролировать срок', 'Lane_Secretary', 13, 1);
N('Task_PublishOrder', 'user', 'Опубликовать приказ', 'Lane_Secretary', 14, 0,
  { doc: 'После подписи проект становится приказом: темы и руководители закреплены.' });
N('DataObj_Order', 'data', 'Приказ об утверждении тем', 'Lane_Secretary', 14, 1);
N('Event_OrderPublished', 'throw', 'Темы утверждены приказом', 'Lane_Secretary', 15, 0);
N('SubProcess_TopicChange', 'sub', 'Смена темы после приказа (по заявлению)', 'Lane_Student', 15, 1, { dx: -32 });
m.subprocess('SubProcess_TopicChange', {
  start: 'Нужна смена темы',
  tasks: ['Заполнить и подать заявление на смену темы', 'Согласовать новую тему с руководителем', 'Внести изменение в приказ'],
  end: 'Тема изменена',
});

/* Этап 3. Работа над ВКР */
N('Event_EndSemester', 'timer', 'Конец первого семестра', 'Lane_Student', 16, 0);
N('Task_Bibliography', 'user', 'Оформить список литературы по требованиям вуза', 'Lane_Student', 17, 0);
N('Task_BibCheck', 'service', 'Автопроверка оформления и признаков генерации источников', 'Lane_Student', 18, 0);
N('Gateway_BibOk', 'xor', 'Оформление корректно?', 'Lane_Student', 19, 0);
N('Task_FixBib', 'user', 'Исправить список литературы', 'Lane_Student', 19, 1);
N('Gateway_ReviewerMode', 'xor', 'Как подобрать рецензентов?', 'Lane_Secretary', 20, 0);
N('Task_ShuffleReviewers', 'service', 'Подобрать рецензентов случайно, без повторов', 'Lane_Secretary', 21, 0);
N('Task_TeacherPick', 'user', 'Указать предпочтительных рецензентов', 'Lane_Teacher', 21, 0);
N('Gateway_ReviewerJoin', 'xor', '', 'Lane_Secretary', 22, 0);
N('Event_Screen1Date', 'timer', 'Зима: первый просмотр', 'Lane_Board', 23, 0);
N('Task_Screening1', 'user', 'Просмотр № 1: оценка и комментарии двух преподавателей', 'Lane_Board', 24, 0,
  { doc: 'Двое преподавателей, не руководитель студента: комментарий, оценка и контакт — куда и когда подойти.' });
N('Event_Screen2Date', 'timer', 'Весна: второй просмотр', 'Lane_Board', 25, 0);
N('Task_Screening2', 'user', 'Просмотр № 2: оценка и комментарии двух преподавателей', 'Lane_Board', 26, 0,
  { doc: 'Состав второго просмотра не повторяет первый.' });
N('Event_BeforePredef', 'timer', 'Март–апрель: за 1–2 месяца до предзащиты', 'Lane_Teacher', 27, 0);
N('Task_CodeReview', 'user', 'Провести ревью кода и выдать замечания', 'Lane_Teacher', 28, 0);
N('Task_FixCode', 'user', 'Устранить замечания по коду', 'Lane_Student', 29, 0);

/* Этап 4. Допуск */
N('Task_PrepareDocs', 'user', 'Заполнить титульный лист и задание по шаблонам', 'Lane_Student', 30, 0);
N('Task_UploadWork', 'user', 'Загрузить работу на нормоконтроль', 'Lane_Student', 31, 0);
N('Task_NormControl', 'user', 'Нормоконтроль: метаданные, разделы, оформление, код', 'Lane_Norm', 32, 0,
  { doc: 'Проверка по методичке: поля и метаданные, состав и связность разделов, обязательный минимум содержания, оформление кода.' });
N('Gateway_NormOk', 'xor', 'Замечания устранены?', 'Lane_Norm', 33, 0);
N('Task_FixNorm', 'user', 'Устранить замечания нормоконтроля', 'Lane_Student', 33, 1);
N('Task_Antiplagiat', 'user', 'Проверить работу на антиплагиат и выдать справку', 'Lane_Norm', 34, 0,
  { doc: 'Проверку выполняет нормоконтролёр вручную; справка подписывается отдельно и прикладывается к работе.' });
N('Gateway_PlagOk', 'xor', 'Оригинальность достаточна?', 'Lane_Norm', 35, 0);
N('Task_FixText', 'user', 'Доработать текст работы', 'Lane_Student', 35, 1);
N('DataObj_PlagReport', 'data', 'Справка об антиплагиате', 'Lane_Norm', 35, 1);
N('Task_CollectPackage', 'user', 'Собрать пакет документов', 'Lane_Student', 36, 0,
  { doc: 'Титульный лист, задание, справка об антиплагиате. Подписанный список литературы добавляется позже, перед сшиванием.' });

/* Этап 5. Предзащита, подписи, сшивание, защита */
N('Event_PredefDate', 'timer', 'Май: предзащита', 'Lane_Board', 37, 0);
N('Task_Predefense', 'user', 'Предзащита: три преподавателя очно смотрят работу', 'Lane_Board', 38, 0);
N('Gateway_Admitted', 'xor', 'Допущен к защите?', 'Lane_Board', 39, 0);
N('Task_FixAfterPre', 'user', 'Доработать работу по замечаниям предзащиты', 'Lane_Student', 39, 1);
N('Task_SendBibLibrary', 'send', 'Отправить список литературы в библиотеку', 'Lane_Student', 40, 0);
N('Event_BibSigned', 'msgin', 'Список литературы подписан', 'Lane_Student', 41, 0);
N('DataObj_BibSigned', 'data', 'Подписанный список литературы', 'Lane_Student', 42, 1);
N('Task_BindWork', 'manual', 'Сшить работу', 'Lane_Student', 42, 0);
N('Task_HeadSign', 'user', 'Подписать сшитую работу', 'Lane_Head', 43, 0,
  { doc: 'Заведующий кафедрой подписывает уже сшитую работу, перед защитой.' });
N('Task_Defense', 'user', 'Защита ВКР перед комиссией', 'Lane_Board', 44, 0);
N('EndEvent_Done', 'end', 'ВКР защищена, оценка выставлена', 'Lane_Board', 45, 0);

/* Пояснения */
N('Note_Topics', 'note', 'Первый круг таблицы: темы на выбор, без фамилий студентов', 'Lane_Teacher', 3, 1);
N('Note_Submit', 'note', 'Второй круг: фамилия студента и формулировка, которая пойдёт в диплом', 'Lane_Student', 9, 1);
N('Note_Change', 'note', 'После приказа тему меняют только по письменному заявлению', 'Lane_Norm', 15, 1);
N('Note_Bib', 'note', 'Библиография сдаётся в конце первого семестра', 'Lane_Norm', 17, 1);
N('Note_Reviewers', 'note', 'Рецензенты — преподаватели, не ведущие этого студента', 'Lane_Norm', 21, 1);
N('Note_Screen', 'note', 'Оценка, комментарий и контакт: куда и когда подойти', 'Lane_Norm', 24, 1);
N('Note_Window', 'note', 'Просмотр — окно в несколько дней: за это время студент и преподаватели должны встретиться; за просрочкой следит замзав вручную', 'Lane_Norm', 22, 1);
N('Note_PredefDay', 'note', 'Предзащита — один день, внутри слоты по времени', 'Lane_Norm', 37, 1);
N('Note_Norm', 'note', 'Сейчас вручную; проверку по методичке планируется отдать LLM', 'Lane_Head', 32, 0);
N('Note_Plag', 'note', 'Антиплагиат остаётся ручной проверкой нормоконтролёра', 'Lane_Head', 34, 0);
N('Note_Templates', 'note', 'Шаблоны титульного листа и задания — на сайте или в боте', 'Lane_Student', 30, 1);
N('Note_HeadSign', 'note', 'Подпись — после предзащиты и сшивания, перед защитой', 'Lane_Student', 43, 1);

/* Потоки */
F('StartEvent_Cycle', 'Task_PlanCalendar');
F('Task_PlanCalendar', 'Task_OpenTable', '', 'hvh');
F('Task_OpenTable', 'Task_CollectTopics', '', 'hvh');
F('Task_CollectTopics', 'Task_ShareTable', '', 'hvh');
F('Task_ShareTable', 'Task_StudentReview', '', 'hvh');
F('Task_StudentReview', 'Gateway_TopicChoice');
F('Gateway_TopicChoice', 'Task_PickTopic', 'тема из перечня');
F('Gateway_TopicChoice', 'Task_NewTopic', 'своя тема', 'hvh');
F('Gateway_TopicChoice', 'Task_AdjustTopic', 'корректировка', 'hvh');
F('Task_PickTopic', 'Gateway_TopicJoin');
F('Task_NewTopic', 'Gateway_TopicJoin', '', 'hvh');
F('Task_AdjustTopic', 'Gateway_TopicJoin', '', 'hvh');
F('Gateway_TopicJoin', 'Task_SubmitStudent', '', 'hvh');
F('Task_SubmitStudent', 'Task_DraftOrder', '', 'hvh');
F('Task_DraftOrder', 'Task_SendOrder');
F('Task_SendOrder', 'Event_OrderReply');
F('Event_OrderReply', 'Gateway_Signed');
F('Gateway_Signed', 'Task_PublishOrder', 'подписан');
F('Gateway_Signed', 'Task_ReturnForFix', 'есть замечания', 'vh');
F('Task_ReturnForFix', 'Task_FixTopic', '', 'hv');
F('Task_FixTopic', 'Task_DraftOrder', '', 'hv');
F('Task_PublishOrder', 'Event_OrderPublished');
F('Event_OrderPublished', 'Event_EndSemester', '', 'hvh');
F('Event_EndSemester', 'Task_Bibliography');
F('Task_Bibliography', 'Task_BibCheck');
F('Task_BibCheck', 'Gateway_BibOk');
F('Gateway_BibOk', 'Gateway_ReviewerMode', 'да', 'hvh');
F('Gateway_BibOk', 'Task_FixBib', 'нет', 'vh');
F('Task_FixBib', 'Task_BibCheck', '', 'hv');
F('Gateway_ReviewerMode', 'Task_ShuffleReviewers', 'случайный подбор');
F('Gateway_ReviewerMode', 'Task_TeacherPick', 'по предпочтению руководителя', 'hvh');
F('Task_ShuffleReviewers', 'Gateway_ReviewerJoin');
F('Task_TeacherPick', 'Gateway_ReviewerJoin', '', 'hvh');
F('Gateway_ReviewerJoin', 'Event_Screen1Date', '', 'hvh');
F('Event_Screen1Date', 'Task_Screening1');
F('Task_Screening1', 'Event_Screen2Date');
F('Event_Screen2Date', 'Task_Screening2');
F('Task_Screening2', 'Event_BeforePredef', '', 'hvh');
F('Event_BeforePredef', 'Task_CodeReview');
F('Task_CodeReview', 'Task_FixCode', '', 'hvh');
F('Task_FixCode', 'Task_PrepareDocs');
F('Task_PrepareDocs', 'Task_UploadWork');
F('Task_UploadWork', 'Task_NormControl', '', 'hvh');
F('Task_NormControl', 'Gateway_NormOk');
F('Gateway_NormOk', 'Task_Antiplagiat', 'да');
F('Gateway_NormOk', 'Task_FixNorm', 'нет', 'vh');
F('Task_FixNorm', 'Task_NormControl', '', 'hv');
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

/* Слияния, внешние участники, сообщения, связи и группы */
m.insertMerge('Gateway_PredefMerge', 'Task_Predefense');
m.insertMerge('Gateway_PlagMerge', 'Task_Antiplagiat');
m.insertMerge('Gateway_NormMerge', 'Task_NormControl');
m.insertMerge('Gateway_BibMerge', 'Task_BibCheck');
m.insertMerge('Gateway_OrderMerge', 'Task_DraftOrder');

m.external({ id: 'Participant_Rectorate', name: 'Ректорат: подписание приказа', anchor: 'Task_SendOrder', anchor2: 'Event_OrderReply', side: 'top' });
m.external({ id: 'Participant_Library', name: 'Библиотека: проверка и подпись списка литературы', anchor: 'Task_SendBibLibrary', anchor2: 'Event_BibSigned', side: 'bottom' });
m.message({ id: 'MessageFlow_OrderOut', name: 'Проект приказа на подпись', src: 'Task_SendOrder', tgt: 'Participant_Rectorate' });
m.message({ id: 'MessageFlow_OrderBack', name: 'Подписанный приказ или замечания', src: 'Participant_Rectorate', tgt: 'Event_OrderReply' });
m.message({ id: 'MessageFlow_BibOut', name: 'Список литературы', src: 'Task_SendBibLibrary', tgt: 'Participant_Library' });
m.message({ id: 'MessageFlow_BibBack', name: 'Подписанный список', src: 'Participant_Library', tgt: 'Event_BibSigned' });

m.annotate('Task_PlanCalendar', 'Note_Deputy');
m.annotate('Task_CollectTopics', 'Note_Topics');
m.annotate('Task_SubmitStudent', 'Note_Submit');
m.annotate('SubProcess_TopicChange', 'Note_Change');
m.annotate('Task_Bibliography', 'Note_Bib');
m.annotate('Task_ShuffleReviewers', 'Note_Reviewers');
m.annotate('Task_Screening1', 'Note_Screen');
m.annotate('Event_Screen1Date', 'Note_Window');
m.annotate('Event_PredefDate', 'Note_PredefDay');
m.annotate('Task_NormControl', 'Note_Norm');
m.annotate('Task_Antiplagiat', 'Note_Plag');
m.annotate('Task_PrepareDocs', 'Note_Templates');
m.annotate('Task_HeadSign', 'Note_HeadSign');
m.data('Task_DraftOrder', 'DataObj_OrderDraft');
m.data('Task_PublishOrder', 'DataObj_Order');
m.data('Task_Antiplagiat', 'DataObj_PlagReport');
m.data('Event_BibSigned', 'DataObj_BibSigned');

m.group('Group_Stage1', 'Этап 1. Таблица тем и подача студентов', 'StartEvent_Cycle', 'Task_SubmitStudent');
m.group('Group_Stage2', 'Этап 2. Проект приказа и приказ', 'Gateway_OrderMerge', 'Event_OrderPublished');
m.group('Group_Stage3', 'Этап 3. Работа над ВКР: библиография, просмотры, ревью кода', 'Event_EndSemester', 'Task_FixCode');
m.group('Group_Stage4', 'Этап 4. Допуск: нормоконтроль и антиплагиат', 'Task_PrepareDocs', 'Task_CollectPackage');
m.group('Group_Stage5', 'Этап 5. Предзащита, подписи и защита', 'Event_PredefDate', 'EndEvent_Done');

const { xml, problems, stats } = m.build();
fs.writeFileSync(__dirname + '/vkr-process-as-is.bpmn', xml);
console.log(problems.length ? 'ПРОБЛЕМЫ РАСКЛАДКИ:\n  ' + problems.join('\n  ') : 'Раскладка: пересечений нет');
console.log('as-is:', stats);
