/**
 * Helper to dispatch in-app notifications
 */
export const createNotification = async (supabaseClient, { userId, title, content, type = 'info' }) => {
  try {
    const { data, error } = await supabaseClient
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        content: content || null,
        type,
        is_read: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error dispatching notification:', err);
    return null;
  }
};
