import { type BoardDetail, COMMENT_BODY_MAX_LENGTH, type Comment } from '@flowbit/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { MessageSquareIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useMe } from '@/features/auth/queries';
import { useEditingSignal } from '@/features/boards/board-live';
import { Markdown } from '@/features/boards/markdown';
import { relativeTime } from '@/lib/time';
import { MentionTextarea } from './mention-textarea';
import { toEditable, toStored } from './mentions';
import { commentsQuery, useCommentMutations } from './queries';

export function Comments({
  cardId,
  board,
  canComment,
}: {
  cardId: string;
  board: BoardDetail;
  canComment: boolean;
}) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery(
    commentsQuery(cardId),
  );
  const { create, update, remove } = useCommentMutations(cardId);
  const [draft, setDraft] = useState('');
  const [editingComment, setEditingComment] = useState(false);
  useEditingSignal(board.id, cardId, draft.trim().length > 0 || editingComment);
  const people = board.members.map((member) => member.user);
  const comments = data?.pages.flatMap((page) => page.items) ?? [];

  const submit = () => {
    const body = toStored(draft.trim(), people);
    if (!body) return;
    create.mutate(body, { onSuccess: () => setDraft('') });
  };

  return (
    <section className="grid gap-3" aria-labelledby={`comments-${cardId}`}>
      <h3 id={`comments-${cardId}`} className="flex items-center gap-2 font-semibold">
        <MessageSquareIcon className="size-4" aria-hidden />
        {t('comments.title')}
      </h3>

      {canComment && me ? (
        <div className="flex gap-2">
          <Avatar user={me} size="md" />
          <form
            className="grid flex-1 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <MentionTextarea
              value={draft}
              onChange={setDraft}
              members={board.members}
              onSubmit={submit}
              rows={2}
              maxLength={COMMENT_BODY_MAX_LENGTH}
              placeholder={t('comments.placeholder')}
              aria-label={t('comments.write')}
            />
            {draft.trim() ? (
              <div className="flex items-center gap-2">
                <Button size="sm" type="submit" disabled={create.isPending}>
                  {t('comments.submit')}
                </Button>
                <span className="text-xs text-muted-foreground">{t('comments.hint')}</span>
              </div>
            ) : null}
          </form>
        </div>
      ) : null}

      <ol className="grid gap-4">
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            board={board}
            isAuthor={comment.author?.id === me?.id}
            canDelete={comment.author?.id === me?.id || board.role === 'ADMIN'}
            onEdit={(body) =>
              update.mutate({ commentId: comment.id, body: toStored(body, people) })
            }
            onDelete={() => remove.mutate(comment.id)}
            onEditingChange={setEditingComment}
          />
        ))}
      </ol>
      {hasNextPage ? (
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {t('comments.loadMore')}
        </Button>
      ) : null}
    </section>
  );
}

function CommentItem({
  comment,
  board,
  isAuthor,
  canDelete,
  onEdit,
  onDelete,
  onEditingChange,
}: {
  comment: Comment;
  board: BoardDetail;
  isAuthor: boolean;
  canDelete: boolean;
  onEdit: (body: string) => void;
  onDelete: () => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [editing, setEditingState] = useState(false);
  const setEditing = (next: boolean) => {
    setEditingState(next);
    onEditingChange(next);
  };
  const [draft, setDraft] = useState('');
  const people = board.members.map((member) => member.user);
  const author = comment.author ?? { id: 'deleted', name: t('comments.deletedUser'), image: null };

  const save = () => {
    const body = draft.trim();
    if (body) onEdit(body);
    setEditing(false);
  };

  return (
    <li className="flex gap-2">
      <Avatar user={author} size="md" />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold">{author.name}</span>
          <time dateTime={comment.createdAt} className="text-xs text-muted-foreground">
            {relativeTime(comment.createdAt, i18n.language)}
          </time>
          {comment.editedAt ? (
            <span className="text-xs text-muted-foreground">{t('comments.edited')}</span>
          ) : null}
        </p>
        {editing ? (
          <div className="grid gap-2">
            <MentionTextarea
              value={draft}
              onChange={setDraft}
              members={board.members}
              onSubmit={save}
              rows={3}
              maxLength={COMMENT_BODY_MAX_LENGTH}
              aria-label={t('comments.edit')}
              escapeHandled
              autoFocus
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  setEditing(false);
                }
              }}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={save}>
                {t('common.saveChanges')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-card px-3 py-2">
            <Markdown people={people}>{comment.body}</Markdown>
          </div>
        )}
        {!editing && (isAuthor || canDelete) ? (
          <div className="flex gap-3 text-xs text-muted-foreground">
            {isAuthor ? (
              <button
                type="button"
                className="underline-offset-2 hover:underline"
                onClick={() => {
                  setDraft(toEditable(comment.body, people));
                  setEditing(true);
                }}
              >
                {t('comments.editAction')}
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className="underline-offset-2 hover:underline"
                onClick={() => {
                  if (window.confirm(t('comments.deleteConfirm'))) onDelete();
                }}
              >
                {t('common.delete')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
