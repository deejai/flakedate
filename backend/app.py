from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from sqlalchemy.exc import IntegrityError
import os
from datetime import datetime
import uuid
import secrets
import smtplib
from email.mime.text import MIMEText
from email.utils import make_msgid, formataddr

app = Flask(__name__)
CORS(app)

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'flakedate.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Event(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    date = db.Column(db.Date, nullable=False)
    description = db.Column(db.String(500), nullable=False)
    email1 = db.Column(db.String(120), nullable=False)
    email2 = db.Column(db.String(120), nullable=False)
    unique_token = db.Column(db.String(64), unique=True, nullable=False)
    user1_flake = db.Column(db.Boolean, default=False)
    user2_flake = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat(),
            'description': self.description,
            'email1': self.email1,
            'email2': self.email2,
            'user1_flake': self.user1_flake,
            'user2_flake': self.user2_flake
        }

def generate_unique_token():
    while True:
        token = secrets.token_urlsafe(48)
        if not Event.query.filter_by(unique_token=token).first():
            return token

def send_email(to_email, subject, message):
    from_email = 'noreply@flakedate.com'
    msg = MIMEText(message)
    msg['Subject'] = subject
    msg['From'] = formataddr(("FlakeDate", from_email))
    msg['To'] = to_email
    msg['Message-ID'] = make_msgid()

    try:
        with smtplib.SMTP('localhost') as server:
            server.sendmail(from_email, [to_email], msg.as_string())
        print(f"{datetime.now()}: Sent email to {to_email}")
        return True
    except Exception as e:
        print(f"{datetime.now()}: Error sending email to {to_email}: {e}")
        return False

@app.route('/api/events', methods=['POST'])
def create_event():
    data = request.json
    try:
        unique_token = generate_unique_token()
        new_event = Event(
            id=str(uuid.uuid4()),
            date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
            description=data['description'],
            email1=data['email1'],
            email2=data['email2'],
            unique_token=unique_token
        )
        db.session.add(new_event)
        db.session.commit()

        # Send emails to both participants
        base_url = request.host_url.rstrip('/')
        for email in [new_event.email1, new_event.email2]:
            subject = "You've been invited to a FlakeDate event!"
            message = f"""
            Hello!

            You've been invited to a FlakeDate event on {new_event.date.strftime('%B %d, %Y')}.

            Event description: {new_event.description}

            To view and manage your event, please visit this link:
            {base_url}/event/{unique_token}

            Remember, this link is shared between both participants. Don't share it with anyone else!

            Best regards,
            The FlakeDate Team
            """
            send_email(email, subject, message)

        return jsonify({
            'eventId': new_event.id,
            'eventToken': unique_token
        }), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Failed to create event'}), 400

@app.route('/api/events/<token>/status', methods=['GET'])
def check_status(token):
    event = Event.query.filter_by(unique_token=token).first()
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    
    user_email = request.args.get('email')
    if user_email not in [event.email1, event.email2]:
        return jsonify({'error': 'Unauthorized'}), 403

    is_user1 = user_email == event.email1
    user_flaked = event.user1_flake if is_user1 else event.user2_flake
    both_flaked = event.user1_flake and event.user2_flake
    
    return jsonify({
        'userFlaked': user_flaked,
        'bothFlaked': both_flaked,
        'eventDetails': {
            'date': event.date.isoformat(),
            'description': event.description
        }
    })

@app.route('/api/events/<token>/toggle', methods=['POST'])
def toggle_flake(token):
    event = Event.query.filter_by(unique_token=token).first()
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    
    data = request.json
    user_email = data.get('email')
    
    if user_email == event.email1:
        event.user1_flake = not event.user1_flake
        user_flaked = event.user1_flake
        other_user_email = event.email2
    elif user_email == event.email2:
        event.user2_flake = not event.user2_flake
        user_flaked = event.user2_flake
        other_user_email = event.email1
    else:
        return jsonify({'error': 'Unauthorized'}), 403
    
    db.session.commit()
    
    both_flaked = event.user1_flake and event.user2_flake
    
    if both_flaked:
        subject = "FlakeDate Update: Both parties are feeling flakey!"
        message = f"""
        Hello!

        We wanted to let you know that both you and the other participant for the event on {event.date.strftime('%B %d, %Y')} are feeling flakey.

        Event description: {event.description}

        You might want to consider rescheduling or confirming your plans.

        Best regards,
        The FlakeDate Team
        """
        send_email(event.email1, subject, message)
        send_email(event.email2, subject, message)
    elif user_flaked:
        # Only send an email to the other user if they haven't flaked
        if (user_email == event.email1 and not event.user2_flake) or (user_email == event.email2 and not event.user1_flake):
            subject = "FlakeDate Update: Status changed"
            message = f"""
            Hello!

            The status for your event on {event.date.strftime('%B %d, %Y')} has been updated.

            Event description: {event.description}

            You can check the current status by visiting your event page.

            Best regards,
            The FlakeDate Team
            """
            send_email(other_user_email, subject, message)
    
    return jsonify({
        'userFlaked': user_flaked,
        'bothFlaked': both_flaked
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
